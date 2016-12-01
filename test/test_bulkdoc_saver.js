/* global require console process describe it */

var should = require('should')

var _ = require('lodash')
var superagent = require('superagent')

var bulkdoc_saver = require('../.')

var superagent = require('superagent')
var config_okay = require('config_okay')



var path = require('path')
var rootdir = path.normalize(__dirname)
var config_file = rootdir+'/../test.config.json'
var config={}
var db ='test%2fbulk%2fsaver'

var docs = {'docs':[{'_id':'doc1'
                    ,foo:'bar'}
                   ,{'_id':'doc2'
                    ,'baz':'bat'}
                   ]}

function create_tempdb(config,db,cb){
    if(typeof db === 'function'){
        throw new Error('db required now')
    }
    var cdb =
        [config.couchdb.host+':'+config.couchdb.port
         ,db].join('/')
    if(! /http/.test(cdb)){
        cdb = 'http://'+cdb
    }

    superagent.put(cdb)
    .type('json')
    .auth(config.couchdb.auth.username
         ,config.couchdb.auth.password)
        .end(function(err,result){
            // now populate that db with some docs
            superagent.post(cdb+'/_bulk_docs')
                .type('json')
                .set('accept','application/json')
                .send(docs)
                .end(function(e,r){
                    if(e){
                        return cb(e)
                    }
                    _.each(r.body
                           ,function(resp){
                               resp.should.have.property('ok')
                               resp.should.have.property('id')
                               resp.should.have.property('rev')
                           });
                    return cb()
                })
            return null

        })

    return null
}

before(function(done){
    var date = new Date()
    var test_db_unique = date.getHours()+'-'
        + date.getMinutes()+'-'
        + date.getSeconds()+'-'
        + date.getMilliseconds()+'-'+Math.floor(Math.random() * 100)
    db += '_'+test_db_unique
    config_okay(config_file,function(err,c){
        if ( c === undefined ){
            throw new Error('problem reading configuration file '+config_file+'.  Check that the file exists, and that the permissions are set to 0600')
        }
        config.couchdb=c.couchdb
        config.couchdb.db = db
        create_tempdb(config,db,done)
        return null
    })
    return null
})
after(function(done){
    var cdb =
        [config.couchdb.host+':'+config.couchdb.port
        ,db].join('/')
    if(! /http/.test(cdb)){
        cdb = 'http://'+cdb
    }
    superagent.del(cdb)
    .type('json')
    .auth(config.couchdb.auth.username
         ,config.couchdb.auth.password)
        .end(function(e,r){
            return done()
        })
    return null
})


describe('save bulk docs, with some new, some old',function(){

    it('should bulk save docs'
      ,function(done){

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

          bulkdoc_saver(_.extend({},config.couchdb,{docs:newdocs}),function(err,res){
              should.not.exist(err)
              res.length.should.eql(4)
               _.each(res,function(r){
                   r.should.have.property('ok')
                   r.should.have.property('id')
                   r.should.have.property('rev')
               });
              done()
              return null
          })
          return null

      })
    return null
})


describe('save bulk docs, with all new',function(){

    it('should bulk save docs'
      ,function(done){
          var newdocs = {'docs':[]}
          newdocs.docs.push({'_id':'anotherfirst'
                             ,'garage':'band'
                             ,'password':'secret'})
          newdocs.docs.push({'_id':'anothersecond'
                             ,'garage':'band'
                             ,'password':'secret'})
          bulkdoc_saver(_.extend({},config.couchdb,{docs:newdocs}),function(err,res){
              should.not.exist(err)
              res.length.should.eql(2)
               _.each(res,function(r){
                   r.should.have.property('ok')
                   r.should.have.property('id')
                   r.should.have.property('rev')
               });
               return done()
           })
       })
})

describe('delete bulk docs',function(){
    it('should delete docs',function(done){
        var deldocs = docs.docs.map(function(d){
            d._deleted = true
            return d
        })
        bulkdoc_saver(_.extend({},config.couchdb,{docs:deldocs}),function(err,res){
            should.not.exist(err)
            res.length.should.eql(2)
            _.each(res,function(r){
                r.should.have.property('ok')
                r.should.have.property('id')
                r.should.have.property('rev')
            });
    // double check
              var cdb =
                  [config.couchdb.host+':'+config.couchdb.port
                   ,db].join('/')
              if(! /http/.test(cdb)){
                  cdb = 'http://'+cdb
              }

              superagent.get(cdb+'/'+res[0].id)
                  .type('json')
                  .end(function(err,result){
                      var rt = JSON.parse(result.text)
                      rt.should.have.property('error','not_found')
                      rt.should.have.property('reason','deleted')

                      superagent.get(cdb+'/'+res[1].id)
                          .type('json')
                          .end(function(err2,result2){
                              var rt2 = JSON.parse(result2.text)
                              rt2.should.have.property('error','not_found')
                              rt2.should.have.property('reason','deleted')

                              return done()

                          })
                      return null
                  })
              return null
        })
        return null
    })
    return null
})
