var _ = require('lodash')
var superagent = require('superagent')
var config={'couchdb':{}}
var config_okay = require('config_okay')

/**
 * bulkdoc_saver
 *
 * to save bulkdocs, call with a config object with a couchdb element,
 * and docs that contains a list of docs (or that is an object
 * containing an element docs that holds the list of docs.  blah blah
 * blah)
 *
 * By using this library, there *should* be no rejected cases, but it
 * is possible that you might get a race condition where two requests
 * are trying to simultaneously save the same doc, and the other one
 * wins.  In which case, check this object that each doc response has
 * ok in it, and if not, just resubmit the request for those docs.
 *
 * @param {Object} opts - how to access couchdb, and the docs
 * @param {String} opts.host - the database host.  Required
 * @param {String} opts.port - the database port.  Required
 * @param {String} opts.db - the database to query for
 * @param {Array} opts.docs - the documents to save, as a list
 * @param {Function} cb
 * @returns {}
 */
function bulkdoc_saver(opts,cb){
    if(config.couchdb.host === undefined && opts.config_file !== undefined){
        return config_okay(opts.config_file,function(e,c){
            config.couchdb = c.couchdb
            return _bulkdoc_saver(opts,cb)
        })
    }
    //console.log('depending upon opts object for config info')
    // otherwise, hopefully everything is defined in the opts file!
    return _bulkdoc_saver(opts,cb)
}

function  _bulkdoc_saver(opts,cb){
    var c = {},cdb,cport,cuser,cpass,db,uri_root,docs
    var hash = {}
    var keys = []
    _.assign(c,config.couchdb,opts)

    db = c.db
    if(opts.couchdb !== undefined){
        throw new Error('hey, you are using an old way of doing this')
    }
    cdb = c.host || '127.0.0.1'
    cport = c.port || 5984
    cdb = cdb+':'+cport
    if(! /http/.test(cdb)){
        cdb = 'http://'+cdb
    }
    if(config.couchdb.auth !== undefined){
        cuser = config.couchdb.auth.username
        cpass = config.couchdb.auth.password
    }

    uri_root = cdb +'/' + db
    docs = opts.docs
    if (docs === undefined) {
        throw new Error ('docs must be defined as a field in the config object')
    }
    if(docs.docs !== undefined){
        docs = docs.docs
    }
    // so now docs is just an array
    _.map(docs
          ,function(doc){
              hash[doc._id] = doc
              if(doc._rev === undefined){
                  keys.push( doc._id )
              }
              return null
          });

    if(keys.length > 0){
        var req = superagent.post(uri_root + '/_all_docs')
            .type('json')
            .set('accept','application/json')
        if(cuser && cpass){
            req.auth(cuser,cpass)
        }
        req.send({'keys':keys})
        req.end(function(e,r){
            if(e) return cb(e);
            // now add the revisions to the docs and save updates
            var result = r.body
            var revdocs = _.map(result.rows
                                ,function(row){
                                    if(row.error==='not_found') return hash[row.key]
                                    if(row.error) throw new Error(row.error)
                                    hash[row.id]._rev = row.value.rev;
                                    return hash[row.id]
                                });
            bulker(revdocs,uri_root,cuser,cpass,cb)
            return null
        })
        return null
    }else{
        bulker(docs,uri_root,cuser,cpass,cb)
    }
    return null
}

function bulker (docs,uri_root,cuser,cpass,cb){
    var req2 = superagent.post( uri_root + '/_bulk_docs' )
        .type('json')
        .set('accept','application/json')
    if(cuser && cpass){
        req2.auth(cuser,cpass)
    }
    req2.send({'docs':docs})
    req2.end(function(e,r){
        if(e){ console.log('bulk doc save error '+e)
               return cb(e)
             }
        return cb(null,r.body)
    })
    return null
}

module.exports=bulkdoc_saver
