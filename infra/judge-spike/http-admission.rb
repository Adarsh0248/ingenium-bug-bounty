require 'json'
require 'base64'

# shortcut: one frozen trusted fixture only; replace with reviewed admission validation before participant code.
class IngeniumLabAdmission
  class UniqueObject < Hash
    def []=(key, value)
      raise ArgumentError, 'Duplicate key' if key?(key)
      super
    end
  end

  def initialize(app)
    @app = app
    @context = JSON.parse(File.binread('/api/ingenium-http-context.json'))
    @binding = @context.fetch('binding')
    @path = '/ingenium-lab/attempts'
    @lookup = @path + '/' + @binding.fetch('attempt_id')
    @token = ENV.fetch('AUTHN_TOKEN')
    raise 'Missing fixed authentication' unless /\A[0-9a-f]{64}\z/.match?(@token)
  end

  def reply(status, value)
    body = JSON.generate(value)
    [status, {'Content-Type' => 'application/json', 'Cache-Control' => 'no-store',
              'Content-Length' => body.bytesize.to_s}, [body]]
  end

  def observe(connection)
    where = @binding.map { |key, value| key + ' = ' + connection.quote(value) }.join(' AND ')
    connection.exec_query("SELECT provider_id::text AS token, submission_id, state, permit_count, " \
                          "state <> 'SEALED' AS reserved, evidence_sha256 " \
                          "FROM ingenium_http_v1.attempts WHERE " + where).first
  end

  def register(connection)
    connection.execute("SET LOCAL lock_timeout = '1s'")
    connection.execute("SET LOCAL statement_timeout = '5s'")
    connection.execute('SELECT pg_advisory_xact_lock(194731801)')
    existing = observe(connection)
    return existing if existing

    payload = @context.fetch('payload').dup
    %w[source_code stdin].each { |key| payload[key] = Base64.strict_decode64(payload.fetch(key)) }
    submission = Submission.create!(payload)
    envelope = {'class' => 'ActiveJob::QueueAdapters::ResqueAdapter::JobWrapper',
                'args' => [IsolateJob.new(submission.id).serialize]}
    columns = @binding.keys + %w[provider_id submission_id envelope]
    values = @binding.values + [submission.token, submission.id, JSON.generate(envelope)]
    connection.execute('INSERT INTO ingenium_http_v1.attempts (' + columns.join(', ') +
                       ') VALUES (' + values.map { |value| connection.quote(value) }.join(', ') + ')')
    observe(connection)
  end

  def call(env)
    path = env.fetch('PATH_INFO', '')
    return @app.call(env) unless path == @path || path.start_with?(@path + '/')
    return reply(401, {'error' => 'unauthorized'}) unless
      ActiveSupport::SecurityUtils.secure_compare(@token, env.fetch('HTTP_X_AUTH_TOKEN', ''))
    request = Rack::Request.new(env)
    return reply(400, {'error' => 'query_not_allowed'}) unless request.query_string.empty?
    return reply(404, {'error' => 'unknown_attempt'}) unless path == @path || path == @lookup
    if request.post? && path == @path
      return reply(415, {'error' => 'json_required'}) unless request.media_type == 'application/json'
      raw = request.body.read(4097)
      return reply(413, {'error' => 'body_too_large'}) if raw.bytesize > 4096
      binding = JSON.parse(raw, object_class: UniqueObject)
      return reply(409, {'error' => 'binding_mismatch'}) unless binding == @binding
      row = ActiveRecord::Base.connection_pool.with_connection do |connection|
        ActiveRecord::Base.transaction { register(connection) }
      end
      return reply(201, row)
    end
    if request.get? && path == @lookup
      row = ActiveRecord::Base.connection_pool.with_connection { |connection| observe(connection) }
      return row ? reply(200, row) : reply(404, {'error' => 'not_registered'})
    end
    reply(405, {'error' => 'method_not_allowed'})
  rescue JSON::ParserError, ArgumentError
    reply(400, {'error' => 'invalid_json'})
  rescue StandardError
    # A failed response is not proof of rollback; the caller must resolve its saved attempt ID.
    reply(503, {'error' => 'uncertain_registration'})
  end
end

Rails.application.config.middleware.insert_before 0, IngeniumLabAdmission
