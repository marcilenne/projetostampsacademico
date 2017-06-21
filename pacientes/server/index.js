var express = require('express');
var passport = require('passport');
var Strategy = require('passport-facebook').Strategy
var User = require('./models/user');
var Detail = require('./models/detail');
var mongoose = require('mongoose');
var configDB = require('./config/database.js');
var path = require('path');
var bodyParser = require('body-parser');
var kafka = require('kafka-node'),
    Producer = kafka.Producer,
    client = new kafka.Client(process.env.ZOOKEEPER || '34.204.88.242:2181'),
    producer = new Producer(client);

var config = {
  port: process.env.PORT || '8080'
}

mongoose.connect(configDB.url);
// Configure the Facebook strategy for use by Passport.
//
// OAuth 2.0-based strategies require a `verify` function which receives the
// credential (`accessToken`) for accessing the Facebook API on the user's
// behalf, along with the user's profile.  The function must invoke `cb`
// with a user object, which will be set at `req.user` in route handlers after
// authentication.
// ****
// configure o nome stampsacademico.com no host apontando para localhost.
// ****
passport.use(new Strategy({
    clientID: '251768885289067',
    clientSecret: '69803b262211015ea714b2593e690e26',
    callbackURL: process.env.CALLBACK || 'https://stamps2-mknarciso.c9users.io/login/facebook/return',
    profileFields: ['id', 'emails', 'displayName', 'name', 'gender', 'picture.type(large)']
  },
  function(accessToken, refreshToken, profile, cb) {
    process.nextTick(function() {
      User.findOne({ 'facebook.id': profile.id }, function(err, user) {
        
        if (err)
          return cb(err);
        if (user) {
          return cb(null, user);
        } else {
          
          var newUser = new User();
          newUser.facebook.id = profile.id;
          newUser.facebook.token = accessToken;
          newUser.facebook.displayName = profile.displayName;
          if (profile.emails) { 
            newUser.facebook.email = (profile.emails[0].value || '').toLowerCase();
          } else {
            newUser.facebook.email = profile.email
          }

          if (profile.photos) { 
            newUser.facebook.photo = profile.photos[0].value;
          }
          newUser.save(function(err) {
            if (err)
              throw err;
            return cb(null, newUser);
          });
        }
      });
    });
    // In this example, the user's Facebook profile is supplied as the user
    // record.  In a production-quality application, the Facebook profile should
    // be associated with a user record in the application's database, which
    // allows for account linking and authentication with other identity
    // providers.
    //return cb(null, profile);
  }));


// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  In a
// production-quality application, this would typically be as simple as
// supplying the user ID when serializing, and querying the user record by ID
// from the database when deserializing.  However, due to the fact that this
// example does not have a database, the complete Facebook profile is serialized
// and deserialized.
passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});


// Create a new Express application.
var app = express();

// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/bower_components', express.static(__dirname + '/bower_components'));

// Define routes.
app.get('/',
  function(req, res) {
    res.render('home', { user: req.user });
  });

app.get('/login',
  function(req, res){
    res.render('login');
  });

app.get('/report', function(req, res) {
  mongoose.model('Detail').find(function(err,ills){
    //res.setHeader('Content-Type', 'application/json');
    //res.send(JSON.stringify(ills), null, 3);
    var sintomas = [];
    ills.forEach(function(ill) {
      ill.symptoms.forEach(function(sintoma) {
        sintomas.push(sintoma);
      })
    });
    var aux = new Set(sintomas);
    var unique = Array.from(aux).sort();
    var data = unique;
    res.render('sintomas',{data: data,user: req.user});
    //res.send(unique.toString());
  });
  }
);
  

app.get('/login/facebook'
  , passport.authorize('facebook', { scope : ['email'] }));

app.get('/login/facebook/return', 
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/medicosProximos',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res){
    res.render('medicosProximos', { user: req.user}
      );
  });

app.get('/paProximos',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res){
    res.render('paProximos', {user: req.user}
      );
  });

app.get('/sintomasForm',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res){
    
    res.render('sintomasForm', {user: req.user}
      );
  });

/**bodyParser.json(options)
 * Parses the text as JSON and exposes the resulting object on req.body.
 */
app.use(bodyParser.json());

app.post('/sintomasEnvio', 
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var dados = req.body;
    dados.symptomsdate = Math.floor(Date.now() / 1000);
    res.setHeader('Content-Type', 'application/json');
    //console.log(JSON.stringify(dados, null, 3));
    res.send(JSON.stringify(dados, null, 3));
    payloads = [
       { topic: 'det-paciente', messages: JSON.stringify(dados), partition: 0 },
    ];
    producer.send(payloads, function(err, data){
       console.log(data)
    });

  }
);

app.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res){
    console.log(req.user);
    res.render('profile', {user: req.user}
      );
  });


app.listen(config.port, function () {
  console.log('Running on port ' + config.port);
})
