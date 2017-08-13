/* global require console process describe it */

const tap = require('tap')
const superagent = require('superagent')

var bulkdoc_saver = require('../.')

const path    = require('path')
const rootdir = path.normalize(__dirname)
const config_okay = require('config_okay')
const config_file = rootdir+'/../test.config.json'
const config={}
const utils = require('./utils.js')

tap.plan(4)

var db ='test%2fbulk%2fsaver'

var docs = {'docs':[{'_id':'doc1'
                    ,foo:'bar'}
                   ,{'_id':'doc2'
                    ,'baz':'bat'}
                   ]}


function all_old(t){
    docs.docs = docs.docs.map( (doc) =>{
        return Object.assign({},doc,{'schmaltered':true})
    })
    return bulkdoc_saver(Object.assign({},config.couchdb,{docs:docs}))

        .then( res => {
            t.is(res.length,2)

            res.forEach((r)=>{
                t.ok(r.ok,'has property ok')
                t.ok(r.id,'has property id')
                t.ok(r.rev,'has property rev')
                // brute force, but it is just a test
                if(docs.docs[0]._id === r.id){
                    docs.docs[0]._rev = r.rev
                    docs.docs[0].scmaltered = 7
                }else{
                    docs.docs[1]._rev = r.rev
                    docs.docs[0].scmaltered = 8
                }
                return null
            })
        })
        .then( () =>{
            return bulkdoc_saver(Object.assign({},config.couchdb,{docs:docs}))
        })
        .then( res => {
            t.is(res.length,2)

            res.forEach((r)=>{
                t.ok(r.ok,'has property ok')
                t.ok(r.id,'has property id')
                t.ok(r.rev,'has property rev')
                // brute force, but it is just a test
                if(docs.docs[0]._id === r.id){
                    docs.docs[0]._rev = r.rev
                }else{
                    docs.docs[1]._rev = r.rev
                }
                return null
            })
            t.end()
            return null
        })

}


function new_and_old(t){

    const newdocs = Object.assign({},docs)
    newdocs.docs = newdocs.docs.map( (doc) =>{
        return Object.assign({},doc,{'altered':true})
    })
    newdocs.docs.push({'_id':'first'
                       ,'garage':'band'
                       ,'password':'secret'})
    newdocs.docs.push({'_id':'second'
                       ,'garage':'band'
                       ,'password':'secret'})

    bulkdoc_saver(Object.assign({},config.couchdb,{docs:newdocs})
                  ,function(err,res){
                      t.notOk(err)
                      t.is(res.length,4)
                      res.forEach((r)=>{
                          t.ok(r.ok,'has property ok')
                          t.ok(r.id,'has property id')
                          t.ok(r.rev,'has property rev')
                          return null
                      })
                      t.end()
                  })
    return null
}


function all_new(t){

    const newdocs = {'docs':[]}
    newdocs.docs.push({'_id':'anotherfirst'
                       ,'garage':'band'
                       ,'password':'secret'})
    newdocs.docs.push({'_id':'anothersecond'
                       ,'garage':'band'
                       ,'password':'secret'})
    bulkdoc_saver(Object.assign({},config.couchdb,{docs:newdocs})
                  ,function(err,res){
                      t.notOk(err)
                      t.is(res.length,2)
                      res.forEach((r)=>{
                          t.ok(r.ok,'has property ok')
                          t.ok(r.id,'has property id')
                          t.ok(r.rev,'has property rev')
                          return null
                      })
                      t.end()
                  })
}

const check_del = (t,cdb,id)=>{
    return superagent.get(cdb+'/'+id)
        .type('json')
        .set('accept','application/json')
        .then(result=>{
            t.fail('should not have found document',id)
        }).catch(e=>{
            t.match(e.response.body,
                    {"error":"not_found","reason":"deleted"})
            return null
        })
}

function del_docs(t){

    const deldocs = docs.docs.map(function(d){
        d._deleted = true
        return d
    })

    bulkdoc_saver(Object.assign({},config.couchdb,{docs:deldocs})
                  ,function(err,res){
                      t.notOk(err)
                      t.is(res.length,2)
                      res.forEach((r)=>{
                          t.ok(r.ok,'has property ok')
                          t.ok(r.id,'has property id')
                          t.ok(r.rev,'has property rev')
                          return null
                      })
                      // double check
                      var cdb =
                          [config.couchdb.host+':'+config.couchdb.port
                           ,config.couchdb.db].join('/')
                      if(! /http/.test(cdb)){
                          cdb = 'http://'+cdb
                      }
                      const jobs = res.map(r=>{
                          return check_del(t,cdb,r.id)
                      })
                      return Promise.all(jobs)
                          .then( (deljobs)=>{
                              // console.log(deljobs)
                              t.end()
                          })
                  })
    return null
}

config_okay(config_file)
    .then( (c) => {
        if(!c.couchdb.db){ throw new Error('need valid db defined in test.config.json')}
        config.couchdb = c.couchdb
        return utils.create_tempdb(config)
    })
    .then(()=>{
        return utils.populate_tempdb(config,docs)
    })
    .then(()=>{
        return tap.test('test bulk docs, new and old',new_and_old)
    })
    .then(()=>{
        return tap.test('test bulk docs all new',all_new)
    })
    .then(()=>{
        return tap.test('test bulk docs all old',all_old)
    })
    .then(()=>{
        return tap.test('test bulk delete',del_docs)
    })
    .then(()=>{
        tap.end()
        return utils.teardown(config)
    })
    .catch(function(e){
        throw e
    })
