require 'json'
require 'stringio'
require 'base64'

# No database, queue or compiler is reachable from these stubs.
TOKEN = 'a' * 64
JOBS = (0...18).to_h do |index|
  binding = {'attempt_id' => format('8cf9f0bd-8374-4d81-bbf5-%012d', index), 'host_epoch' => '53cb2405-35a8-4f72-909a-7fb9aab466e3',
             'manifest_sha256' => 'b' * 64, 'payload_sha256' => 'c' * 64}
  [index.to_s, {'binding' => binding, 'payload' => {'source_code' => Base64.strict_encode64('fixed'), 'stdin' => Base64.strict_encode64("pass\n")}}]
end
ENV['AUTHN_TOKEN'] = TOKEN
class << File
  alias_method :real_binread, :binread
  def binread(path); path == '/api/ingenium-verdict-context.json' ? JSON.generate({'jobs' => JOBS}) : real_binread(path); end
end
module Rails
  def self.application; self; end
  def self.config; self; end
  def self.middleware; self; end
  def self.insert_before(*); end
end
module ActiveSupport
  module SecurityUtils
    def self.secure_compare(a, b); a == b; end
  end
end
module Rack
  class Request
    def initialize(env); @env = env; end
    def query_string; @env.fetch('QUERY_STRING', ''); end
    def post?; @env['REQUEST_METHOD'] == 'POST'; end
    def get?; @env['REQUEST_METHOD'] == 'GET'; end
    def media_type; @env['CONTENT_TYPE']; end
    def body; @env['rack.input']; end
  end
end
class Connection
  attr_accessor :rows, :fail_insert
  attr_reader :commands
  def initialize; @rows = {}; @commands = []; end
  def quote(value); "'" + value.to_s.gsub("'", "''") + "'"; end
  def exec_query(sql)
    @commands << sql
    row = @rows[sql.match(/attempt_id = '([^']+)'/)[1]]&.dup
    row&.delete('evidence') unless sql.include?(' AS evidence FROM ')
    row ? [row] : []
  end
  def execute(sql)
    @commands << sql
    return unless sql.start_with?('INSERT INTO')
    raise 'Lost operation' if @fail_insert
    id = sql.match(/VALUES \('([^']+)'/)[1]
    @rows[id] = {'token' => 'provider-' + id, 'submission_id' => Submission.count, 'state' => 'PREPARED', 'permit_count' => 0,
                 'reserved' => true, 'recovery_required' => false, 'evidence_sha256' => nil, 'evidence' => nil}
  end
end
CONNECTION = Connection.new
module ActiveRecord
  class Base
    def self.connection_pool; self; end
    def self.with_connection; yield CONNECTION; end
    def self.transaction
      count, rows = Submission.count, CONNECTION.rows.dup
      begin; yield
      rescue StandardError
        Submission.count, CONNECTION.rows = count, rows
        raise
      end
    end
  end
end
class Submission
  class << self; attr_accessor :count; end
  self.count = 0
  def self.create!(payload)
    raise 'Payload is not a plain mutable hash' unless payload.instance_of?(Hash)
    raise 'Not decoded' unless payload == {'source_code' => 'fixed', 'stdin' => "pass\n"}
    self.count += 1
    Struct.new(:id, :token).new(count, 'provider')
  end
end
class IsolateJob
  def initialize(id); @id = id; end
  def serialize; {'arguments' => [@id]}; end
end

eval(DATA.read, TOPLEVEL_BINDING, 'verdict-admission.rb')
guarded = JSON.parse('{"source_code":"Zml4ZWQ=","stdin":"cGFzcwo="}', object_class: IngeniumVerdictAdmission::UniqueObject)
begin
  guarded.dup['source_code'] = 'fixed'
  raise 'Duplicating the parser object unexpectedly removed duplicate-key protection'
rescue ArgumentError => error
  raise unless error.message == 'Duplicate key'
end
plain = guarded.to_h
raise 'Parser conversion did not copy into a plain Hash' unless plain.instance_of?(Hash) && !plain.equal?(guarded)
plain['source_code'] = Base64.strict_decode64(plain.fetch('source_code'))
raise 'Normalization changed frozen input' unless plain['source_code'] == 'fixed' && guarded['source_code'] == 'Zml4ZWQ='
begin
  JSON.parse('{"source_code":"a","source_code":"b"}', object_class: IngeniumVerdictAdmission::UniqueObject)
  raise 'Duplicate JSON field accepted'
rescue ArgumentError => error
  raise unless error.message == 'Duplicate key'
end
app = IngeniumVerdictAdmission.new(->(_) { [202, {}, ['stock']] })
frozen_context = JSON.generate(app.instance_variable_get(:@jobs))
path = '/ingenium-verdict/attempts'
def check(app, status, method, path, raw = '', changes = {})
  env = {'REQUEST_METHOD' => method, 'PATH_INFO' => path, 'HTTP_X_AUTH_TOKEN' => TOKEN,
         'CONTENT_TYPE' => 'application/json', 'rack.input' => StringIO.new(raw)}.merge(changes)
  result = app.call(env)
  raise "Expected #{status}, got #{result[0]}" unless result[0] == status
  result
end
check(app, 202, 'POST', '/submissions')
check(app, 401, 'GET', path + '/unknown/evidence', '', 'HTTP_X_AUTH_TOKEN' => '')
check(app, 400, 'POST', path, '{}', 'QUERY_STRING' => 'token=x')
check(app, 415, 'POST', path, '{}', 'CONTENT_TYPE' => 'text/plain')
check(app, 413, 'POST', path, 'x' * 4097)
check(app, 400, 'POST', path, '{')
check(app, 400, 'POST', path, '{"attempt_id":"a","attempt_id":"b"}')
check(app, 409, 'POST', path, JSON.generate(JOBS['0']['binding'].merge('extra' => true)))
raise 'Rejected requests touched DB' unless CONNECTION.commands.empty? && Submission.count == 0
JOBS.each_with_index do |(_, job), index|
  binding = job['binding']
  lookup = path + '/' + binding['attempt_id']
  check(app, 404, 'GET', lookup)
  CONNECTION.fail_insert = true
  count = Submission.count
  check(app, 503, 'POST', path, JSON.generate(binding))
  raise 'Failed transaction retained data' unless Submission.count == count && !CONNECTION.rows.key?(binding['attempt_id'])
  CONNECTION.fail_insert = false
  first = check(app, 201, 'POST', path, JSON.generate(binding))
  raise 'Duplicate changed association' unless check(app, 201, 'POST', path, JSON.generate(binding)) == first && Submission.count == count + 1
  check(app, 409, 'GET', lookup + '/evidence')
  row = CONNECTION.rows.fetch(binding['attempt_id'])
  held = index == 17
  row.merge!('state' => held ? 'STARTED' : 'SEALED', 'permit_count' => 1, 'reserved' => held, 'recovery_required' => held,
             'evidence_sha256' => 'e' * 64, 'evidence' => JSON.generate({'verdict' => held ? nil : 'RUNTIME_ERROR', 'recovery_required' => held}))
  reply = JSON.parse(check(app, 200, 'GET', lookup + '/evidence')[2].join)
  raise 'Held/sealed semantics changed' unless reply['reserved'] == held && reply['recovery_required'] == held && reply['evidence']['recovery_required'] == held
  check(app, 401, 'GET', lookup + '/evidence', '', 'HTTP_X_AUTH_TOKEN' => '')
  check(app, 405, 'DELETE', lookup)
end
raise 'Wrong record count' unless Submission.count == 18
raise 'Admission changed frozen context' unless JSON.generate(app.instance_variable_get(:@jobs)) == frozen_context
begin
  app.reply(200, {'oversized' => 'x' * 2097152})
  raise 'Oversized response accepted'
rescue RuntimeError => error
  raise unless error.message == 'Oversized evidence'
end
puts 'PASS: fixed verdict admission stub checks passed'
__END__
