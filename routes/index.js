var express = require('express');
var router = express.Router();
var parser = require('parse-rss');
var passport = require('passport');
var Sample = require('../models/models.js').Sample;
var Job = require('../models/models.js').Job;
var Status = require('../models/models.js').Status;
var Calibration = require('../models/models.js').Calibration;

var currentCommandId = 1;

/* GET home page. */
router.get('/', function(req, res, next) {
  Page.updateOrCreate(null, function(err, page) {
    if (err) throw err;
    parser('http://blog.projectmo.net/rss', function(err, out) {
      if (err) throw err;
      var latest = out[0];
      latest.summary = latest.summary.replace(/<(?:.|\n)*?>/gm, '').slice(0, -1);
      res.render('index', {
        title: 'Project MoNET',
        route: "index",
        latest: latest,
        page: page
      });
    });
  });
});

router.get('/gallery', function(req, res, next) {
  res.sendfile('MoNETGallery/MoNetCanvas.html');
});


router.get('/colorwall1', function(req, res, next) {
  var id = req.query.id;
  //console.log(id);
  Job.getTopSamples(function(colors) {
    //console.log(colors);
    res.render('colorwall1', {
      title: 'Project MoNET:Colorwall',
      colors: colors
    });
  });
});

router.get('/simulator', function(req, res, next) {
  res.render('simulator', {
    title: 'Project MoNET:Simulator'
  });
});

router.get('/sample/:red/:green/:blue', function(req, res, next) {
  //console.log(req.params);
  var color = req.params;
  res.set('Content-Type', 'application/json');
  res.send(calibration);
  calibration.reset();
});

router.get('/motor/:direction', function(req, res, next) {
  //console.log(req.params);
  motor.direction = req.params.direction == 'cw' ? 'ccw' : 'cw';
  res.set('Content-Type', 'application/json');
  res.send(motor);
});

router.get('/color', function(req, res, next) {
  res.render('color2', {
    title: 'Project MoNET:Color Sampler'
  });
});

router.get('/portrait', function(req, res, next) {
  res.render('points', {
    title: 'Project MoNET:Portrait Creator'
  });
});

router.get('/monitor', function(req, res, next) {
  res.render('monitor', {
    title: 'Project MoNET:Robot Monitor'
  });
});


/*We're using funky dot notation for incoming messages from the robot. We're just going to stick everything in one request.
  This will serve three purposes:
    -give next command to the robot as a response.
    -mark the previous command as finished
    -update periodic/emergency status
*/

            //robotcontol/mowpjf38qe.fetch  .0         .0    .0    .0    .0    .0    .0    .429495  .4294995 .0     .0     .-60    .1
router.get('/robotcontol/:hardwareID.:action.:commandId.:xPos.:yPos.:xLimMax.:yLimMax.:signal.:status', function(req ,res, next) {
  console.log(req.params);
  res.set('Content-Type', 'application/json');
  if(req.params.hardwareID == "mowpjf38qe") {
    Status.updateStatus( req.params, function (err, status) {
      console.log(status.message);
    if( req.params.action == "status") {
      console.log("got status");
      res.json({message : "OK"});
    } else {
      if(req.params.action == "complete") {
        console.log("Command " + req.params.commandId + " marked as complete");
      }
      // this needs to be replaced with logic to get the next incomplete command and send it
      currentCommandId++;
      var paintTop = 255;

      var command = {
            cr: 1,
            cid : currentCommandId,
            x : parseInt(Math.random() * req.params.xLimMax), //x destination
            y : parseInt(Math.random() * req.params.yLimMax), //y destination
            s : 5000, //speed at which the steppers will move for this command
            r : 255,//parseInt(Math.random() * paintTop), //paint pump rates
            g : 255,//parseInt(Math.random() * paintTop),
            b : 0,//parseInt(Math.random() * paintTop * 0.25),
            w : 150,
            k : 0,//parseInt(Math.random() * paintTop) * 0.25,
            m : 0,
            d : 255,
            cl : 255
        };
        res.json(command);
      }
    });

  } else {
    res.json({ message : "Invalid HardwareID!" });
  }
});

//Move calibration into private area.
router.get('/calibration', function(req, res, next) {
  Calibration.findUpdateOrCreate(null, function( err, cal ) {
      if(err) console.log(err);
      res.render('calibration', {
        title: 'Project MoNET:Calibrator',
        calibration : cal
      });
  });
});

router.put('/calibration', function(req, res, next) {
  var data = req.body;
  Calibration.findUpdateOrCreate(data, function( err, cal ) {
      if(err) console.log(err);
      res.send({
        result: "success"
      });
  });
});

router.get('/login', function(req, res, next) {
  res.render('login', {
    title: 'Project MoNET:Log In',
    heading: "You must be authorized to do this.",
    message: "Please click below to login. You will be directed to authorize this app through Facebook, " +
      "which is our identity provider. Once authorized, one of our admins will need to elevate your privileges " +
      "so that you may access the private areas."
  });
});

router.get('/auth/facebook',
  passport.authenticate('facebook'));

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    //console.log(req.user.name);
    // Successful authentication, redirect home.
    res.redirect('/');
  });


//Admin DB stuff
var User = require('../models/models.js').User;
var Page = require('../models/models.js').Page;

//Private stuff, don't read or the app will break!
router.get('/private/:dest', function(req, res, next) {
  console.log(req.params.dest);
  if (req.user) {
    if (req.user.elevated || req.user.owner) {
      switch (req.params.dest) {

        case "users":
          User.find().exec(function(err, users) {
            res.render("users", {
              title: 'Project MoNET:User Management',
              users: users
            });
          });
          break;


        case "frontpage":
          Page.findOne().exec(function(err, page) {
            res.render("frontpage", {
              title: 'Project MoNET:Front Page Editor',
              page: page
            });
          });
          break;

        case "works":
          page = req.query.page || 0;
          Job.get(5, page, function(err, works) {
            res.render("works", {
              title: 'Project MoNET:Work Control',
              works: works
            });
          });
          break;

        default:
          res.redirect('/');
      }
    } else {
      console.log('not priv');
      res.render('blocked', {
        title: 'Not Authorized'
      });
    }
  } else {
    console.log('not auth');
    res.redirect('/login');
  }
});



//For updating admin stuff
router.put('/private/:dest', function(req, res, next) {
  if (req.user) {
    if (req.user.elevated || req.user.owner) {
      var data = req.body;

      switch (req.params.dest) {
        case "users":
          console.log(data._id, data.elevated);
          User.update(data, function(status) {
            res.send({
              result: status
            });
          });
          break;

        case "frontpage":
          Page.updateOrCreate(data, function(err, page) {
            if (!err) {
              res.send({
                result: "success"
              });
            } else {
              res.send({
                result: "failure"
              });
            }
          });
          break;

        case "works":
          //console.log(data);
          switch (data.action) {
            case "add":
              Job.create(function(job) {
                res.send({
                  result: "success"
                });
              });
              break;
            case "play":
              Job.play(data.id, function(job) {
                res.send({
                  result: "success"
                });
              });
              break;
            case "pause":
              Job.pause(data.id, function(job) {
                res.send({
                  result: "success"
                });
              });
              break;
            case "update":
              Job.userUpdate(data, function(job) {
                res.send({
                  result: "success"
                });
              });
              break;
          }
          break;

      }
    }
  }
});

module.exports = router;
