var cocaine = require("cocaine")
var worker = new cocaine.Worker(argv)
var handle = worker.getListenHandle("http")
var http_ = cocaine.http // monkey-patches http, so should be done

var os_ = require('os');
var cluster_ = require('cluster');
var path_ = require('path');
var fs_ = require('fs');

var de = require('./de.js');

require('./de.file.js');
require('./de.script.js');
require('./de.block.js');
require('./de.context.js');
require('./de.result.js');

//  ---------------------------------------------------------------------------------------------------------------  //

de.server = {};

//  ---------------------------------------------------------------------------------------------------------------  //

var _server;

//  ---------------------------------------------------------------------------------------------------------------  //

de.server.init = function(config) {
    config = de.script.init(config);

    if ( !(config.port || config.socket) || config.help ) {
        usage();
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

function usage() {
    var name = '    ' + path_.basename(require.main.filename);

    console.log('Usage:');
    console.log(name + ' --port 2000 --rootdir test/pages');
    console.log(name + ' --socket descript.sock --rootdir test/pages');
    console.log(name + ' --config test/config.json');
    console.log();

    process.exit(0);
}

//  ---------------------------------------------------------------------------------------------------------------  //

de.server.start = function() {
    var app = function(req, res) {
        //  Если это post-запрос, то его параметры приходится получать
        //  асинхронно. Поэтому de.Context.create() возвращает promise.
        //
        de.Context.create(req).done(function(context) {
            de.server.onrequest(req, res, context);
        });
    }

    if(cocaine.spawnedBy()) {
        var W = new cocaine.Worker(argv)
        var handle = W.getListenHandle('http')
        var server = http_.createServer(app)
        server.listen(handle, function(){
            console.log('listening on cocaine handle')
        })
    } else {
        if (cluster_.isMaster) {
            //  cluster_.setupMaster({ silent: true });

            de.log.info('master started. pid = ' + process.pid);

            var fork_worker = function() {
                var forked = cluster_.fork();
                de.log.info('process forked. pid = ' + forked.process.pid);

                /*
                  forked.process.stdout.on('data', function(data) {
                  process.stdout.write(data);
                  });
                  forked.process.stderr.on('data', function(data) {
                  process.stderr.write(data);
                  });
                */
            };

            // Fork workers.
            var workers = de.config.workers || ( os_.cpus().length - 1 );
            
            for (var i = 0; i < workers; i++) {
                fork_worker();
            }

            cluster_.on('exit', function(worker, code, signal) {
                de.log.error('process died. pid = ' + worker.process.pid + ' code = ' + code + ' signal = ' + signal);
                fork_worker();
            });

        } else {
            _server = http_.createServer(app);

            if (de.config.socket) {
                _server.listen(de.config.socket, function() {
                    //  FIXME: Опять забыл, зачем нужна эта строчка.
                    fs_.chmodSync(this.address(), 0777);
                });
            } else {
                _server.listen(de.config.port, '::', 'localhost');
            }
        }
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.server.stop = function() {
    if (_server) {
        _server.close();
        _server = null;
    }

    de.file.unwatch();
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.server.route = function(req, res, context) {
    var path = context.request.url.pathname || '';
    if ( path.charAt(0) === '/' ) {
        path = path.substr(1);
    }
    path = path || 'index.jsx';

    return path;
};

de.server.onrequest = function(req, res, context) {
    var t1 = Date.now();

    var block = de.server.route(req, res, context);
    if ( !(block instanceof de.Block) ) {
        block = new de.Block.Include(block);
    }

    //  FIXME: Добавить сюда ip, headers, честный path из запроса.
    block.run(context.query, context)
        .done(function(result) {
            if (result instanceof de.Result.Error && result.get('id') === 'FILE_OPEN_ERROR') {
                res.statusCode = 404;
                res.end( result.formatted() );
                return;
            }

            context.response.end(res, result);

        })
        .always(function() {
            context.log_end('info', '[request ' + JSON.stringify(req.url) + '] ended', t1);
        });
};

//  ---------------------------------------------------------------------------------------------------------------  //

