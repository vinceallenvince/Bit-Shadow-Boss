console.log('Node app started | version: ' + process.version);

var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    url = require('url'),
    fs = require('fs'),
    http = require('http'),
    path = require('path'),
    EventEmitter = require('events').EventEmitter;

app.listen(8080);

// Will emit data events on this emitter
var emitter = new EventEmitter();

var startFrame = 0,
    endFrame = 0,
    currentFrame = 0,
    totalFrames = 0,
    completedFrames = 0,
    hostData = 'www.bitshadowmachine.com',
    pathToData = '/boss/data';

http.get({host: hostData, path: pathToData + '/config.json'}, function(response) {
  var result = '';

  // another chunk of data has been recieved; append it to `result`
  response.on('data', function (chunk) {
    result += chunk;
  });

  // the whole response has been recieved
  response.on('end', function () {
    result = JSON.parse(result);
    startFrame = result.startFrame;
    currentFrame = result.startFrame;
    endFrame = result.endFrame;
    totalFrames = (result.endFrame - result.startFrame) + 1;
  });
});


function handler(req, res) {

  var parts = url.parse(req.url).pathname.split('/'), // split out parts of the path
      filename = path.basename(req.url) || 'index.html', // look for filename in path
      ext = path.extname(filename), // get extension
      localPath = __dirname + '/public/'; // get path to static files

  if (req.method === 'GET' && ext === '.html') {
    localPath += filename;
    fs.exists(localPath, function(exists) {
      if (exists) {
        getFile(localPath, res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  }

  if (req.method === 'GET' && parts[1] === 'data') {

    // check if we're done
    if (currentFrame > endFrame) {
      res.end(JSON.stringify({stop: true}));
    }

    http.get({host: hostData, path: pathToData + '/frame' + currentFrame + '.json'}, function(response) {
      var result = '';

      // another chunk of data has been recieved; append it to `result`
      response.on('data', function (chunk) {
        result += chunk;
      });

      // the whole response has been recieved
      response.on('end', function () {
        res.end(result);
        emitter.emit('frameNew', {  // Emit the data on the emitter
          frameNumber: currentFrame,
          host: req.headers.host
        });
        currentFrame++; // increment current frame
      });

      response.on('error', function (err) {
        console.log('Boss error reading data file: ' + err);
      });
    });
  }

  if (req.method === 'GET' && parts[1] === 'complete') {

    var frameDuration = null;
    if (parts.length > 3) {
      frameDuration = parts[3]
    }

    completedFrames++;
    res.end('thank you.');
    emitter.emit('frameComplete', {  // Emit the data on the emitter
      frameNumber: parts[2],
      frameDuration: frameDuration,
      host: req.headers.host
    });
    emitter.emit('frameUpdate', {
      totalFrames: totalFrames,
      completedFrames: completedFrames
    });
  }
}

function getFile(localPath, res) {
  fs.readFile(localPath, function(err, contents) {
    if (!err) {
      res.end(contents);
    } else {
      res.writeHead(500);
      res.end();
    }
  });
}

io.sockets.on('connection', function(socket) {

  socket.emit('frameUpdate', {
    totalFrames: totalFrames,
    completedFrames: completedFrames
  });

  emitter.on('frameUpdate', function(data) {
    socket.emit('frameUpdate', data);
  });
  emitter.on('frameNew', function(data) {
    socket.emit('frameNew', data);
  });
  emitter.on('frameComplete', function(data) {
    socket.emit('frameComplete', data);
  });
});
