require 'json'
require 'stringio'
require 'base64'

# Stubbed commands only; no database, queue or compiler can be reached.
TOKEN = 'a' * 64
JOBS = %w[c cpp java python javascript].each_with_index.to_h do |name, index|
  binding = {'attempt_id' => "8cf9f0bd-8374-4d81-bbf5-405d0df2244#{index}",
             'host_epoch' => '53cb2405-35a8-4f72-909a-7fb9aab466e3', 'manifest_sha256' => 'b' * 64, 'payload_sha256' => (index.to_s * 64)}
  [name, {'binding' => binding, 'payload' => {'source_code' => Base64.strict_encode64('fixed-' + name), 'stdin' => Base64.strict_encode64("2\n")}}]
end
ENV['AUTHN_TOKEN'] = TOKEN
class << File
  alias_method :original_binread, :binread
  def binread(path)
    path == '/api/ingenium-transport-context.json' ? JSON.generate({'jobs' => JOBS}) : original_binread(path)
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
  attr_accessor :rows, :fail_insert
  attr_reader :commands
  def initialize; @commands = []; @rows = {}; end
  def quote(value); "'" + value.to_s.gsub("'", "''") + "'"; end
  def exec_query(sql)
    @commands << sql
    id = sql.match(/attempt_id = '([^']+)'/)[1]
    row = @rows[id]&.dup
    row&.delete('evidence') unless sql.include?('evidence_json::text')
    row ? [row] : []
  end
  def execute(sql)
    @commands << sql
    return unless sql.start_with?('INSERT INTO')
    raise 'Lost database operation' if @fail_insert
    id = sql.match(/VALUES \('([^']+)'/)[1]
    @rows[id] = {'token' => 'provider-' + id, 'submission_id' => Submission.count, 'state' => 'PREPARED',
                 'permit_count' => 0, 'reserved' => true, 'evidence_sha256' => nil, 'evidence' => nil}
  end
end
CONNECTION = StubConnection.new
module ActiveRecord
  class Base
    def self.connection_pool; self; end
    def self.with_connection; yield CONNECTION; end
    def self.transaction
      count, rows = Submission.count, CONNECTION.rows.dup
      begin
        yield
      rescue StandardError
        Submission.count = count
        CONNECTION.rows = rows
        raise
      end
    end
  end
end
class Submission
  class << self; attr_accessor :count; end
  self.count = 0
  def self.create!(payload)
    raise 'Fixture not decoded' unless payload['source_code'].start_with?('fixed-') && payload['stdin'] == "2\n"
    self.count += 1
    Struct.new(:id, :token).new(count, 'provider')
  end
end
class IsolateJob
  def initialize(id); @id = id; end
  def serialize; {'arguments' => [@id]}; end
end

eval(DATA.read, TOPLEVEL_BINDING, 'transport-admission.rb')
app = IngeniumTransportAdmission.new(->(_) { [202, {}, ['stock']] })
path = '/ingenium-transport/attempts'
def check(app, status, method, path, raw = '', changes = {})
  env = {'REQUEST_METHOD' => method, 'PATH_INFO' => path, 'HTTP_X_AUTH_TOKEN' => TOKEN,
         'CONTENT_TYPE' => 'application/json', 'rack.input' => StringIO.new(raw)}.merge(changes)
  result = app.call(env)
  raise "Expected #{status}, received #{result[0]}" unless result[0] == status
  result
end
check(app, 202, 'POST', '/submissions')
check(app, 401, 'GET', path + '/unknown/evidence', '', 'HTTP_X_AUTH_TOKEN' => '')
check(app, 400, 'POST', path, '{}', 'QUERY_STRING' => 'token=x')
check(app, 415, 'POST', path, '{}', 'CONTENT_TYPE' => 'text/plain')
check(app, 413, 'POST', path, 'x' * 4097)
check(app, 400, 'POST', path, '{')
check(app, 400, 'POST', path, '{"attempt_id":"a","attempt_id":"b"}')
check(app, 409, 'POST', path, JSON.generate(JOBS['c']['binding'].merge('extra' => true)))
raise 'Invalid request touched DB' unless CONNECTION.commands.empty? && Submission.count == 0
JOBS.each_value do |job|
  binding = job['binding']
  lookup = path + '/' + binding['attempt_id']
  check(app, 404, 'GET', lookup)
  CONNECTION.fail_insert = true
  count = Submission.count
  check(app, 503, 'POST', path, JSON.generate(binding))
  raise 'Failed transaction retained a row' unless Submission.count == count && !CONNECTION.rows.key?(binding['attempt_id'])
  CONNECTION.fail_insert = false
  first = check(app, 201, 'POST', path, JSON.generate(binding))
  again = check(app, 201, 'POST', path, JSON.generate(binding))
  raise 'Duplicate changed association' unless first == again && Submission.count == count + 1
  check(app, 409, 'GET', lookup + '/evidence')
  row = CONNECTION.rows.fetch(binding['attempt_id'])
  row.merge!('state' => 'SEALED', 'permit_count' => 1, 'reserved' => false, 'evidence_sha256' => 'e' * 64, 'evidence' => '{"fixed":true}')
  reply = check(app, 200, 'GET', lookup + '/evidence')
  raise 'Evidence was not structured' unless JSON.parse(reply[2].join)['evidence'] == {'fixed' => true}
  check(app, 401, 'GET', lookup + '/evidence', '', 'HTTP_X_AUTH_TOKEN' => '')
end
check(app, 404, 'GET', path + '/unknown')
check(app, 405, 'DELETE', path + '/' + JOBS['c']['binding']['attempt_id'])
raise 'Not exactly five records' unless Submission.count == 5
begin
  app.reply(200, {'oversized' => 'x' * 2097152})
  raise 'Oversized response accepted'
rescue RuntimeError => error
  raise unless error.message == 'Oversized evidence'
end
puts 'PASS: fixed transport admission stub checks passed'
__END__
