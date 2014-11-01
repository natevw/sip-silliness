var net = require('net'),
    util = require('util');

var PORT = 8080;

// http://tools.ietf.org/html/rfc3261

var FAKE_SDP = [
    "v=0",
    "o=- 1414736453061 1414736453062 IN IP4 192.168.1.16",
    "s=-",
    "c=IN IP4 192.168.1.16",
    "t=0 0",
    "m=audio 51234 RTP/AVP 96 97 3 0 8 127",
    "a=rtpmap:96 GSM-EFR/8000",
    "a=rtpmap:97 AMR/8000",
    "a=rtpmap:3 GSM/8000",
    "a=rtpmap:0 PCMU/8000",
    "a=rtpmap:8 PCMA/8000",
    "a=rtpmap:127 telephone-event/8000",
    "a=fmtp:127 0-15", ''
].join('\r\n');


var MULTI_HEADERS = {'via':true, 'contact':true};

function parseRequest(d) {
  var lines = d.split('\r\n'),
      _req = lines[0].split(' '),
      method = _req[0],
      uri = _req[1],
      sipVersion = _req[2],
      bodyIndex = lines.indexOf('') + 1;
  var headers = {};
  lines.slice(1,bodyIndex-1).forEach(function (_hdr) {
      _hdr = _hdr.split(':');
      var name = _hdr[0].trim(),
          value = _hdr.slice(1).join(':').trim();
      if (name.toLowerCase() in MULTI_HEADERS) {      
        headers[name] || (headers[name] = []);
        headers[name].push(value);
      } else {
          headers[name] = value;
      }
  });
  return {
      sipVersion: sipVersion,
      method: method,
      uri: uri,
      headers: headers,
      bodyLines: lines.slice(bodyIndex)
  };
}

function formResponse(res) {
    var lines = [];
    lines.push([res.sipVersion, res.statusCode, res.reasonPhrase].join(' '));
    Object.keys(res.headers).forEach(function (name) {
        [].concat(res.headers[name]).forEach(function (value) {
            lines.push(name+": "+value);
        });
    });
    lines.push('');
    Array.prototype.push.apply(lines, res.bodyLines);
    return lines.join('\r\n');
}

function formRequest(req) {
    // HACK: swapperoos to reuse code
    return formResponse({
      sipVersion: req.method,
      statusCode: req.uri,
      reasonPhrase: req.sipVersion,
      headers: req.headers,
      bodyLines: req.bodyLines
    });
}


net.createServer(function (socket) {
  var remote = util.format("%s:%s", socket.remoteAddress, socket.remotePort);
  console.log("connection from %s", remote);
  socket.setEncoding('utf-8');
  
  socket.on('data', function (d) {
    // for now just assume everything makes it into one packet…
    console.log(d);
    var req = parseRequest(d),
        res = {
            sipVersion: req.sipVersion,
            statusCode: 200,
            reasonPhrase: "OK",
            headers: {
              'Call-ID': req.headers['Call-ID'],
              'CSeq': req.headers['CSeq'],
              'Via': req.headers['Via'],//.slice(-1)[0] + ";received="+socket.remoteAddress,
              'To': req.headers['To'] + ";tag=42",
              'From': req.headers['From'],
              'Content-Length': 0
            },
            bodyLines: ['']
        };
    if (req.method === 'REGISTER') {
        res.headers['Contact'] = req.headers['Contact'];
    } else if (req.method === 'OPTIONS') {
        res.headers['Content-Type'] = "application/sdp";
        //res.headers['Content-Length'] = 5;
        //res.bodyLines = ['v=0',''];
    }
    socket.write(d = formResponse(res));
    console.log(d);
  });
  
  setTimeout(function () {
      var uri = "sip:test@sip.ipcalf.com:8080";
      var req = {
          method: "INVITE",
          uri: uri,
          sipVersion: "SIP/2.0",
          headers: {
            'Call-ID': 42,
            'CSeq': "1 INVITE",
            'Via': "SIP/2.0/TCP 0.0.0.0:0",
            'To': "<"+uri+">",
            'From': "\"Hey Howdy\" <sip:me@ipcalf.com>",
            'Content-Length': FAKE_SDP.length
          },
          bodyLines: [FAKE_SDP]
      };
    socket.write(d = formRequest(req));
    console.log(d);
  }, 5e3);
  
  
  socket.on('close', function () {
    console.log("%s connection closed.", remote);
  });
}).listen(PORT, function () {
  console.log("listening on", this.address().port);
}).unref();


var dgram = require('dgram');

var socket = dgram.createSocket('udp4', function (msg, rinfo) {
    var d = msg.toString('utf8');
    console.log(d);
});
//socket.unref();

var num = "xxx",
    localAddr = "xxx";


var FAKE_SDP2 = [
    "v=0",
    "o=- 1414816145121 1414816145130 IN IP4 "+localAddr,
    "s=-",
    "c=IN IP4 "+localAddr,
    "t=0 0",
    "m=audio 45848 RTP/AVP 96 97 3 0 8 127",
    "a=rtpmap:96 GSM-EFR/8000",
    "a=rtpmap:97 AMR/8000",
    "a=rtpmap:3 GSM/8000",
    "a=rtpmap:0 PCMU/8000",
    "a=rtpmap:8 PCMA/8000",
    "a=rtpmap:127 telephone-event/8000",
    "a=fmtp:127 0-15", ''
].join('\r\n');

function inviteInfo(uri, localAddr, localPort) {
  var local = localAddr+":"+localPort;
  return {
    method: "INVITE",
    uri: uri+":5060",
    sipVersion: "SIP/2.0",
    headers: {
      'Call-ID': "abc123@192.168.1.16",
      'CSeq': "4000 INVITE",
      'From': "\""+num+"\" <sip:"+num+"@sipgate.co.uk>;tag=99",
      'To': "<"+uri+">",
      'Via': "SIP/2.0/UDP "+local+";branch=abc;rport",
      'Max-Forwards': 70,
      'Contact': "\""+num+"\" <sip:"+num+"@"+local+";transport=udp>",
      'Content-Type': "application/sdp",
      'Proxy-Authorization': "Digest username=\""+num+"\",realm=\"sipgate.co.uk\",nonce=\"xx\",uri=\"sip:"+num+"@sipgate.co.uk:5060\",response=\"xx\"",
      'Content-Length': FAKE_SDP2.length,
    },
    bodyLines: [FAKE_SDP2]
  };
}

socket.bind(0, function () {
  console.log("udp on", this.address().port);
  var invite = inviteInfo("sip:"+num+"@sipgate.co.uk", localAddr, this.address().port),
      msg = formRequest(invite),
      buf = Buffer(msg);
  console.log(msg);
  socket.send(buf, 0, buf.length, 5060, "sipgate.co.uk");
});


