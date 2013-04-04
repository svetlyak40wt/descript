ChangeLog
=========

0.0.31
------

  * Ключик `--cpus` переименован в `--workers`.
    Вместо `--cpus 2` нужно использовать `--workers 1`.
    Дефолтное значение параметра `--workers` — `require('os').cpus().length - 1`.

  * Изменена сигнатура в `options.after` на `(params, context, result)`.
    При этом `result` это инстанс класса `de.Result.*`, а не готовый объект с данными.
    Если нужен доступ к какому-то его содержимому нужно использовать метод `object()`:

        after: function(params, context, result) {
            var o = result.object();

            console.log(o.foo.bar);
        }

  * Контекст первым параметром принимает конфиг (это по идее единственный обязательный параметр):

        new de.Context(config)
        new de.Context(config, request, response)
        new de.Context(config, ...)

    Непонятно, что еще может быть. `de.Request`? Например просто params?

  * Что делать с Response?
    Кажется, нужно унести все просто в контекст.
    И иметь метод типа `context.end(response)`, который выставит куки-заголовки и т.д.