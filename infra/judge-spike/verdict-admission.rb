require 'json'
require 'base64'

# shortcut: eighteen frozen lab jobs only; not a participant admission endpoint.
class IngeniumVerdictAdmission
  class UniqueObject < Hash
    def []=(key, value)
      raise ArgumentError, 'Duplicate key' if key?(key)
      super
    end
  end

  def initialize(app)
    @app = app
    raw = File.binread('/api/ingenium-verdict-context.json')
    raise 'Oversized context' if raw.bytesize > 2097152
    @jobs = JSON.parse(raw, object_class: UniqueObject).fetch('jobs')
    @token = ENV.fetch('AUTHN_TOKEN')
    @path = '/ingenium-verdict/attempts'
    raise 'Invalid fixed context' unless @jobs.size == 18 && /\A[0-9a-f]{64}\z/.match?(@token)
  end

  def reply(status, value)
    body = JSON.generate(value)
    raise 'Oversized evidence' if body.bytesize > 2097152
    [status, {'Content-Type' => 'application/json', 'Cache-Control' => 'no-store', 'Content-Length' => body.bytesize.to_s}, [body]]
  end

  def observe(connection, binding, evidence: false)
    where = binding.map { |key, value| key + ' = ' + connection.quote(value) }.join(' AND ')
    row = connection.exec_query("SELECT provider_id::text AS token, submission_id, state, permit_count, state <> 'SEALED' AS reserved, " \
                               "held_evidence_json IS NOT NULL AS recovery_required, COALESCE(evidence_sha256, held_evidence_sha256) AS evidence_sha256" +
                               (evidence ? ', COALESCE(evidence_json, held_evidence_json)::text AS evidence' : '') +
                               ' FROM ingenium_verdict_http_v1.attempts WHERE ' + where).first
    row['evidence'] = JSON.parse(row.fetch('evidence'), object_class: UniqueObject) if row && evidence && row['evidence']
    row
  end

  def register(connection, job)
    connection.execute("SET LOCAL lock_timeout = '1s'")
    connection.execute("SET LOCAL statement_timeout = '5s'")
    connection.execute('SELECT pg_advisory_xact_lock(194731803)')
    binding = job.fetch('binding')
    old = observe(connection, binding)
    return old if old
    payload = job.fetch('payload').to_h
    %w[source_code stdin].each { |key| payload[key] = Base64.strict_decode64(payload.fetch(key)) }
    submission = Submission.create!(payload)
    envelope = {'class' => 'ActiveJob::QueueAdapters::ResqueAdapter::JobWrapper', 'args' => [IsolateJob.new(submission.id).serialize]}
    columns = binding.keys + %w[provider_id submission_id envelope]
    values = binding.values + [submission.token, submission.id, JSON.generate(envelope)]
    connection.execute('INSERT INTO ingenium_verdict_http_v1.attempts (' + columns.join(', ') + ') VALUES (' +
                       values.map { |value| connection.quote(value) }.join(', ') + ')')
    observe(connection, binding)
  end

  def call(env)
    path = env.fetch('PATH_INFO', '')
    return @app.call(env) unless path == @path || path.start_with?(@path + '/')
    return reply(401, {'error' => 'unauthorized'}) unless ActiveSupport::SecurityUtils.secure_compare(@token, env.fetch('HTTP_X_AUTH_TOKEN', ''))
    request = Rack::Request.new(env)
    return reply(400, {'error' => 'query_not_allowed'}) unless request.query_string.empty?
    if request.post? && path == @path
      return reply(415, {'error' => 'json_required'}) unless request.media_type == 'application/json'
      raw = request.body.read(4097)
      return reply(413, {'error' => 'body_too_large'}) if raw.bytesize > 4096
      binding = JSON.parse(raw, object_class: UniqueObject)
      job = @jobs.values.find { |item| item.fetch('binding') == binding }
      return reply(409, {'error' => 'binding_mismatch'}) unless job
      row = ActiveRecord::Base.connection_pool.with_connection { |c| ActiveRecord::Base.transaction { register(c, job) } }
      return reply(201, row)
    end
    job = @jobs.values.find { |item| path == @path + '/' + item.fetch('binding').fetch('attempt_id') ||
                                     path == @path + '/' + item.fetch('binding').fetch('attempt_id') + '/evidence' }
    return reply(404, {'error' => 'unknown_attempt'}) unless job
    return reply(405, {'error' => 'method_not_allowed'}) unless request.get?
    evidence = path.end_with?('/evidence')
    row = ActiveRecord::Base.connection_pool.with_connection { |c| observe(c, job.fetch('binding'), evidence: evidence) }
    return reply(404, {'error' => 'not_registered'}) unless row
    return reply(409, {'error' => 'not_sealed_or_held'}) if evidence && row['state'] != 'SEALED' && !row['recovery_required']
    reply(200, row)
  rescue JSON::ParserError, ArgumentError
    reply(400, {'error' => 'invalid_json'})
  rescue StandardError
    reply(503, {'error' => 'uncertain_operation'})
  end
end

Rails.application.config.middleware.insert_before 0, IngeniumVerdictAdmission
