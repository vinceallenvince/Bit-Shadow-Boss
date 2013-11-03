console.log('Node app started | version: ' + process.version);

var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    url = require('url'),
    fs = require('fs'),
    path = require('path'),
    EventEmitter = require('events').EventEmitter;

app.listen(8080);

// Will emit data events on this emitter
var emitter = new EventEmitter();

var currentFrame = 1101,
    totalFrames = 0,
    completedFrames = 0,
    pathToData = __dirname;

var dataFiles = fs.readdirSync(pathToData + '/data');
totalFrames = getTotalFrames(dataFiles);

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

    var file = pathToData + '/data/frame' + currentFrame + '.json';

    fs.readFile(file, 'utf8', function (err, data) {
      if (err) {
        console.log('Error: ' + err);
        return;
      }
      res.end(data);
      emitter.emit('frameNew', {  // Emit the data on the emitter
        frameNumber: currentFrame,
        host: req.headers.host
      });
      currentFrame++; // increment current frame
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

/**
 * Iterates over a passed array of file names and counts
 * only the .json files.
 * @param {Array.<string>} dataFiles An array of file names.
 * @return {number} The total number of frames to render.
 */
function getTotalFrames(dataFiles) {
  var i, total = 0;
  for (var i = dataFiles.length - 1; i >=0; i--) {
    if (dataFiles[i].search('.json') !== -1) {
      total++;
    }
  }
  return total;
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
