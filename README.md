
# couchdb_bulkdoc_saver

This is a utility to help out saving docs to couchdb when those docs
might be updating existing docs.

What is does it perform two calls to CouchDB.  The first is to
all_docs, and just grabs the id and revision of the documents you pass
in.  If any of the documents you pass in are already in the database,
then the latest revision is pulled and copied to the document.

Then the second call to CouchDB is to bulk_docs, and the docs are
written.

The return value is passed to a callback you supply.  If no callback
is supplied, then you're on your own.

The program is a function generator.  You call it with the name of the
db to which you are saving, and you get back a bulk saver function.

The program expects that the url, port, username, password are in
environment variables.  If not, there are no defaults for user, pass,
host defaults to localhost, and port to the couchdb standard 5984.
Generally this will work fine, but if you've set up CouchDB to require
valid users, then you need to set the CouchDB user and password
properly.

I'm open to other ways to supply these values, but at the moment I'm
using only this because I am lazy.

var cuser = env.COUCHDB_USER ;
var cpass = env.COUCHDB_PASS ;
var chost = env.COUCHDB_HOST || '127.0.0.1';
var cport = env.COUCHDB_PORT || 5984;


Sample usage:

```javascript
var make_saver = require('couchdb_bulkdoc_saver');
var saver = make_saver('mydb%2fstore');
// make some documents
saver({docs:[doc1,doc2,doc3,...]},
      function(e,response){
          if(e) throw new Error(e);
          _.each(r,function(row){
              // row should have property ok if save was okay
              // and id, and the new rev
          });
      });
```

The first argument to the callback is whether there is an error in
the request, the second is the json object returned from couchdb,
which should have the save state of each document (ok or error,
depending)

By using this library, there *should* be no rejected cases because it
just pulled the latest _rev from the db. But it is possible that you
might get a race condition where two requests are trying to
simultaneously save the same doc, and the other one wins.  In which
case, check this object that each doc response has ok in it, and if
not, just resubmit the request for those docs.
