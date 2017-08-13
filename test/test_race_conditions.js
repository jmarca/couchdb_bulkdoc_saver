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

tap.plan(1)

var db ='test%2fbulk%2fsaver'

var docs = {'docs':[{'_id':'doc1'
                    ,foo:'bar'}
                   ,{'_id':'doc2'
                    ,'baz':'bat'}
                   ]}


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

    const twiddle = [1,2,3,4]
    const twaddle = ['a','b']
    const jobs = twaddle.map(diffr => {
        newdocs.docs.forEach( d => {
            d.twaddle = diffr
        })
        return bulkdoc_saver(Object.assign({},config.couchdb,{docs:newdocs}))
            .then(res =>{
                t.is(res.length,4)
                res.forEach((r)=>{
                    if(r.ok === undefined){
                        t.match(r,{ 'error': 'conflict',
                                    'reason': 'Document update conflict.' })
                    }else{
                        t.ok(r.ok,'has property ok')
                        t.ok(r.id,'has property id')
                        t.ok(r.rev,'has property rev')
                    }
                    return null
                })
            })
            .catch(err => {
                console.log('caught error',err.response.body)
                t.fail('error is bulkdoc save')
                return null
            })
    })
    Promise.all(jobs).then(r=>{
        console.log('done with race condition assignment')
        t.end()
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
        console.log('done with tests')
        tap.end()
        return utils.teardown(config)
    })
    .catch(function(e){
        throw e
    })
