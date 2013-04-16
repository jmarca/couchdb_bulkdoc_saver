var _ = require('lodash')
var superagent = require('superagent')
var env = process.env
var cuser = env.COUCHDB_USER
var cpass = env.COUCHDB_PASS
var chost = env.COUCHDB_HOST  || '127.0.0.1'
var cport = env.COUCHDB_PORT || 5984

var couch = 'http://'+chost+':'+cport

/**
 * make_bulkdoc_saver
 * initialize with the couchdb to save to
 *
 * expects that the url, port, username, password are in environment
 * variables.  If not, there are no defaults for user, pass, host
 * defaults to localhost, and port to the couchdb standard 5984
 *
 * var cuser = env.COUCHDB_USER ;
 * var cpass = env.COUCHDB_PASS ;
 * var chost = env.COUCHDB_HOST || '127.0.0.1';
 * var cport = env.COUCHDB_PORT || 5984;

 * returns a bulkdoc_saver
 *
 * to save bulkdocs, call with
 * saver({docs:[doc1,doc2,doc3,...],
 *       function(e,response){ callback function} )
 *
 * The first argument to the callback is whether there is an error in
 * teh requqest, the second is the json object returned from couchdb,
 * whcih should have the save state of each document (ok or rejected,
 * depending)
 *
 * By using this library, there *should* be no rejected cases, but it
 * is possible that you might get a race condition where two requests
 * are trying to simultaneously save the same doc, and the other one
 * wins.  In which case, check this object that each doc response has
 * ok in it, and if not, just resubmit the request for those docs.
 *
 */

function  make_bulkdoc_saver(cdb){

    return function(docs,next){
        if(next===undefined) next = function(){}
        // passed a block of docs.  need to save them. To do so, first
        // request all of the doc ids, and pick off the current
        // revision number for each
        var hash = {}
        var keys = _.map(docs.docs
                        ,function(doc){
                             hash[doc._id] = doc
                             return doc._id;
                         });

        var uri = couch+'/'+cdb+ '/_all_docs';
        var req = superagent.post(uri)
                  .type('json')
                  .set('accept','application/json')
        if(cuser && cpass){
            req.auth(cuser,cpass)
        }
        req.send({'keys':keys})
        req.end(function(e,r){
            if(e) return next(e);
            // now add the revisions to the docs and save updates
            var result = r.body
            var revdocs = _.map(result.rows
                               ,function(row){
                                    if(row.error==='not_found') return hash[row.key]
                                    if(row.error) throw new Error(row.error)
                                    hash[row.id]._rev = row.value.rev;
                                    return hash[row.id]
                                });
            uri = couch+'/'+cdb+ '/_bulk_docs';
            var req2 = superagent.post(uri)
                       .type('json')
                       .set('accept','application/json')
            if(cuser && cpass){
                req2.auth(cuser,cpass)
            }
            req2.send({'docs':revdocs})
            req2.end(function(e,r){
                if(e){ console.log('bulk doc save error '+e)
                       return next(e)
                     }
                return next(null,r.body)
            })
            return null
        })
        return null
    }
}

module.exports=make_bulkdoc_saver
