/* global require console process describe it */

var should = require('should')

var _ = require('lodash')
var superagent = require('superagent')

var make_bulkdoc_saver = require('../.')

var env = process.env;
var cuser = env.COUCHDB_USER ;
var cpass = env.COUCHDB_PASS ;
var chost = env.COUCHDB_HOST || 'localhost';
var cport = env.COUCHDB_PORT || 5984;

var test_db ='test%2fbulk%2fsaver'
var couch = 'http://'+chost+':'+cport+'/'+test_db

var docs = {'docs':[{'_id':'doc1'
                    ,foo:'bar'}
                   ,{'_id':'doc2'
                    ,'baz':'bat'}
                   ]}
var created_locally=false
before(function(done){
    // create a test db, the put data into it
    superagent.put(couch)
    .type('json')
    .auth(cuser,cpass)
    .end(function(e,r){
        r.should.have.property('error',false)
        if(!e)
            created_locally=true
        // now populate that db with some docs
        superagent.post(couch+'/_bulk_docs')
        .type('json')
        .set('accept','application/json')
        .send(docs)
        .end(function(e,r){
            if(e) done(e)
            _.each(r.body
                  ,function(resp){
                       resp.should.have.property('ok')
                       resp.should.have.property('id')
                       resp.should.have.property('rev')
                   });
            return done()
        })
        return null
    })
})
after(function(done){
    if(!created_locally) return done()

    var couch = 'http://'+chost+':'+cport+'/'+test_db
    // bail in development
    //return done()
    superagent.del(couch)
    .type('json')
    .auth(cuser,cpass)
    .end(function(e,r){
        if(e) return done(e)
        return done()
    })
    return null
})


describe('save bulk docs, with some new, some old',function(){

    it('should bulk save docs'
      ,function(done){
           var saver = make_bulkdoc_saver(test_db)
           var newdocs = _.clone(docs,true)
           newdocs.docs = _.map(newdocs.docs,function(doc){
                         doc.altered=true
                         return doc
                     })
           newdocs.docs.push({'_id':'first'
                        ,'garage':'band'
                        ,'password':'secret'})
           newdocs.docs.push({'_id':'second'
                        ,'garage':'band'
                        ,'password':'secret'})
           saver(newdocs,function(err,res){
               should.not.exist(err)
               _.each(res,function(r){
                   r.should.have.property('ok')
                   r.should.have.property('id')
                   r.should.have.property('rev')
               });
               return done()
           })
       })
})

describe('save bulk docs, with all new',function(){

    it('should bulk save docs'
      ,function(done){
           var saver = make_bulkdoc_saver(test_db)
           var newdocs = {'docs':[]}
           newdocs.docs.push({'_id':'anotherfirst'
                        ,'garage':'band'
                        ,'password':'secret'})
           newdocs.docs.push({'_id':'anothersecond'
                        ,'garage':'band'
                        ,'password':'secret'})
           saver(newdocs,function(err,res){
               should.not.exist(err)
               _.each(res,function(r){
                   r.should.have.property('ok')
                   r.should.have.property('id')
                   r.should.have.property('rev')
               });
               return done()
           })
       })
})
