require 'json'
require 'stringio'

# Command stubs only: this test cannot connect to PostgreSQL, Redis or a sandbox.
TOKEN = 'a' * 64
BINDING = {'attempt_id' => '8cf9f0bd-8374-4d81-bbf5-405d0df22442',
           'host_epoch' => '53cb2405-35a8-4f72-909a-7fb9aab466e3',
           'payload_sha256' => 'b' * 64, 'manifest_sha256' => 'c' * 64}
CONTEXT = {'binding' => BINDING, 'payload' => {'source_code' => 'Zml4ZWQ=', 'stdin' => 'NyA1Cg=='}}
ENV['AUTHN_TOKEN'] = TOKEN
class << File
  alias_method :original_binread, :binread
  def binread(path)
    path == '/api/ingenium-http-context.json' ? JSON.generate(CONTEXT) : original_binread(path)
  end
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
class StubConnection
  attr_accessor :row, :fail_insert
  attr_reader :commands
  def initialize; @commands = []; end
  def quote(value); "'" + value.to_s.gsub("'", "''") + "'"; end
  def exec_query(sql); @commands << sql; @row ? [@row] : []; end
  def execute(sql)
    @commands << sql
    if sql.start_with?('INSERT INTO')
      raise 'Lost database operation' if @fail_insert
      @row = {'token' => 'provider', 'submission_id' => 71, 'state' => 'PREPARED',
              'permit_count' => 0, 'reserved' => true, 'evidence_sha256' => nil}
    end
  end
end
CONNECTION = StubConnection.new
module ActiveRecord
  class Base
    def self.connection_pool; self; end
    def self.with_connection; yield CONNECTION; end
    def self.transaction
      old_count, old_row = Submission.count, CONNECTION.row
      begin
        yield
      rescue StandardError
        Submission.count = old_count
        CONNECTION.row = old_row
        raise
      end
    end
  end
end
class Submission
  class << self; attr_accessor :count; end
  self.count = 0
  def self.create!(payload)
    raise 'Fixture was not decoded' unless payload == {'source_code' => 'fixed', 'stdin' => "7 5\n"}
    self.count += 1
    Struct.new(:id, :token).new(71, 'provider')
  end
end
class IsolateJob
  def initialize(id); @id = id; end
  def serialize; {'arguments' => [@id]}; end
end

eval(DATA.read, TOPLEVEL_BINDING, 'http-admission.rb')
app = IngeniumLabAdmission.new(->(_) { [202, {}, ['stock']] })
lookup = '/ingenium-lab/attempts/' + BINDING['attempt_id']
def check(app, status, method, path, raw = '', changes = {})
  env = {'REQUEST_METHOD' => method, 'PATH_INFO' => path, 'HTTP_X_AUTH_TOKEN' => TOKEN,
         'CONTENT_TYPE' => 'application/json', 'rack.input' => StringIO.new(raw)}.merge(changes)
  reply = app.call(env)
  raise "Expected #{status}, received #{reply[0]}" unless reply[0] == status
  reply
end
check(app, 202, 'POST', '/submissions')
check(app, 401, 'POST', '/ingenium-lab/attempts', '{}', 'HTTP_X_AUTH_TOKEN' => '')
check(app, 404, 'GET', lookup)
check(app, 404, 'GET', '/ingenium-lab/attempts/another-id')
check(app, 405, 'DELETE', lookup)
check(app, 415, 'POST', '/ingenium-lab/attempts', '{}', 'CONTENT_TYPE' => 'text/plain')
check(app, 400, 'POST', '/ingenium-lab/attempts', '{}', 'QUERY_STRING' => 'token=x')
check(app, 413, 'POST', '/ingenium-lab/attempts', 'x' * 4097)
check(app, 400, 'POST', '/ingenium-lab/attempts', '{')
check(app, 400, 'POST', '/ingenium-lab/attempts', '{"attempt_id":"a","attempt_id":"b"}')
check(app, 409, 'POST', '/ingenium-lab/attempts', JSON.generate(BINDING.merge('extra' => true)))
check(app, 409, 'POST', '/ingenium-lab/attempts', JSON.generate(BINDING.merge('payload_sha256' => 'd' * 64)))
raise 'Invalid request touched database' unless Submission.count == 0 && CONNECTION.commands.length == 1
CONNECTION.fail_insert = true
check(app, 503, 'POST', '/ingenium-lab/attempts', JSON.generate(BINDING))
raise 'Failed association retained an orphan' unless Submission.count == 0 && CONNECTION.row.nil?
CONNECTION.fail_insert = false
first = check(app, 201, 'POST', '/ingenium-lab/attempts', JSON.generate(BINDING))
again = check(app, 201, 'POST', '/ingenium-lab/attempts', JSON.generate(BINDING))
raise 'Duplicate registration changed provider' unless first == again && Submission.count == 1
check(app, 200, 'GET', lookup)
raise 'Outbox was not persisted with association' unless CONNECTION.commands.any? { |sql| sql.include?('INSERT INTO ingenium_http_v1.attempts') && sql.include?('envelope') }
puts 'PASS: private admission Ruby stub checks passed (auth, bounds, bindings, rollback and duplicate association)'
__END__
