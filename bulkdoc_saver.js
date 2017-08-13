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

function cb_or_promise( cb, req ) {
    if(!cb || cb === undefined){
        return req // send back the promise object
    }else{
        // wait here for promise object
        req.then(res =>{
            return cb(null,res)
        }).catch(e =>{
            return cb(e)
        })
        return null
    }
}

function get_query(c){
    const db = c.db
    if(db === undefined ){
        throw('db is required in options object under \'db\' key')
    }
    const cport = c.port || 5984
    const host = c.host || '127.0.0.1'
    let cdb = host+':'+cport
    if(! /http/.test(cdb)){
        cdb = 'http://'+cdb
    }
    return cdb+'/'+db
}
const  auth_check = (r,opts)=>{
    if(opts.auth.username && opts.auth.password){
        r.auth(opts.auth.username,opts.auth.password)
    }
    return r
}


const all_docs_handler =  (hash) =>{

    return (response) =>{
        return response.body.rows.map( row => {
            if(row.error==='not_found') return hash[row.key]
            if(row.error) throw new Error(row.error)
            hash[row.id]._rev = row.value.rev;
            return hash[row.id]
        })

    }
}

const submit_all_docs = async (opts,docs) => {
    const cdb = get_query(opts)
    const uri = cdb+ '/_all_docs';
    const keys = []
    const hash = []
    docs.forEach((doc)=>{
        hash[doc._id] = doc
        if(doc._rev === undefined){
            keys.push( doc._id )
        }
        return null
    })
    if(keys.length > 0){
        const handler = all_docs_handler(hash)
        const req = superagent.post(uri)
              .type('json')
              .set('accept','application/json')
        auth_check(req,opts)
        //req.send({'include_docs':true})
        req.send({'keys':keys})
        const r = await req
        const handler_docs = handler(r)
        return handler_docs
    }else{
        return docs
    }
}

const submit_bulk_docs = async (opts, docs) => {
    const cdb = get_query(opts)
    var req2 = superagent.post( cdb + '/_bulk_docs' )
        .type('json')
        .set('accept','application/json')
    auth_check(req2,opts)
    req2.send({'docs':docs})
    const r = await req2
    return r.body
}


async function  _bulkdoc_saver(opts,cb){
    if(opts.couchdb !== undefined){
        throw new Error('hey, you are using an old way of doing this')
    }
    let docs = opts.docs
    if (docs === undefined) {
        throw new Error ('docs must be defined as a field in the config object')
    }
    if(docs.docs !== undefined){
        // sometimes put "docs" under "docs"
        docs = docs.docs
    }
    // so now docs is just an array, not an object

    let  c = {}
    // ,cdb,cport,cuser,cpass,db,uri_root,docs
    Object.assign(c,config.couchdb,opts)
    const query = get_query(c)


    const revdocs = await submit_all_docs(opts,docs)
    const req = submit_bulk_docs(opts,revdocs)
    return cb_or_promise(cb,req)

}


module.exports=bulkdoc_saver
