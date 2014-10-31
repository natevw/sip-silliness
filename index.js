var net = require('net'),
    util = require('util');

var PORT = 8080;

// http://tools.ietf.org/html/rfc3261


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
        res.headers['Content-Length'] = 5;
        res.bodyLines = ['v=0',''];
    }
    socket.write(d = formResponse(res));
    console.log(d);
  });
  socket.on('close', function () {
    console.log("%s connection closed.", remote);
  });
}).listen(PORT, function () {
  console.log("listening on", this.address().port);
});