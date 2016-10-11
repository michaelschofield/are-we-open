var app = new Vue({

  /**
   * @param {string} the selector we want to bind our Vue too. Let's roll!
   */
  el : '.chat',

  data : {

    exceptions : '',
    fiveDays : moment( '2016-11-23' ).utcOffset( -4 ).add( 5, 'days'),
    hours : null,
    messages : [{
      text : null,
      user : null
    }],
    newMessage : '',
    now   : moment( '2016-11-23').utcOffset( -4 ),
    open  : false,
    qualifier : '',
    isException : false,
    tomorrow : moment( '2016-11-23').utcOffset(-4).add( 1, 'days' )
  },

  /**
   * When the Vue is mounted, blast rockets
   */
  created : function() {
    this.init();
  },

  /**
   * Various functions we want to use.
   */
  methods : {

    /**
     * Adds the speech-bubble to the screen
     *
     * @param {string} Text to post
     * @param {string} Designate the chatter, either user or bot
     */
    addMessage : function( value, chatter ) {
      var value = value || this.newMessage;
      if ( !value ) {
        return;
      }
      this.messages.push({
        text : value,
        user : ( chatter ? chatter : 'user' )
      });
      this.newMessage = '';
    },

    /**
     * An ajax wrapper so that we can a little more easily
     * fetch data and then do something once it's been retrieved.
     *
     * @param {url} url
     */
    ajax : function( url ) {
      return new Promise( function( resolve, reject ) {
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
          resolve( this.responseText );
        };
        xhr.onerror = reject;
        xhr.open( 'GET', url );
        xhr.send();
      })
    },

    /**
     * Determines based on our hours json whether we're open. This
     * takes string-y values like "Monday : { "hours" : "24 hours" }"
     * and tries to compare these with the actual time.
     *
     * @param {object} Moment object
     */
    areWeOpen : function( date ) {

      var self  = this,
          day   = ( date ? date.format( 'dddd' ) : self.now.format( 'dddd' ) ),
          date  = ( date ? date : self.now ); // returns our date's day string, ex., "Sunday"

      /**
       * We know which days we are open 24 hours, so on those
       * we're not, we need to check the schedule against the
       * current time.
       *
       * @param {string} Full name of the day, ex., "Sunday"
       */
      _check = function( day ) {

        // Get specifically today's hours
        var hour = self.hours.defaultHours[ day ][ "hours" ],
            open,
            close;

        // Kind of gross cleanup ¯\_(ツ)_/¯
        number = hour.toLowerCase()
          .replace( 'am', '' )
          .replace( 'opens', '' )
          .replace( 'closes', '' )
          .replace( 'midnight', '23' )
          .trim();

        if ( number.indexOf( '-' ) > -1 ) {
          var arr = number.split( '-' );
          open = moment().utcOffset( -4 ).hour( arr[0] );
          close = moment().utcOffset( -4 ).hour( arr[1] );
        } else {
          open = moment().utcOffset( -4 ).hour ( hour );
        }

        _diff( open, close, hour );

      }

      /**
       * Compare the schedule against the present time,
       * then set `self.open` to true or false appropriately. The
       * moment.js library does all the heavy lifting here.
       *
       * @param {object} Moment object
       * @param {object} Optional moment object for a closing hour
       * @param {string} The original "hours" string from the json
       */
      _diff = function( open, close, hour ) {
        if ( !close ) {
          self.open = ( open.diff( self.now ) < self.now ? true : false );
        } else {
          self.open = ( open.diff( self.now ) < self.now && close.diff( self.now ) > self.now ? true : false );
        }

        self.qualifier = hour;
        self.addMessage( 'Our schedule on ' + date.format( 'dddd, MMM Do' ) + ': ' + self.qualifier, 'bot' );
      }

      _getHours = function( date ) {
        _isException( date );
        _setHours();
      }

      /**
       * Is the date in question part of the exceptions object?
       */
      _isException = function( date ) {

        var arr = self.getObjects(self.exceptions,'startDate', '' );
        arr.forEach( function( object ) {
          let start = object[ 'startDate' ].replace(/\//g, '-'),
              end   = object[ 'endDate' ].replace(/\//g, '-'),
              hours = object[ 'hours' ];

          if ( date.isBetween( start, end, 'day', '[]' )  ) {
            self.isException = true;
            self.qualifier = hours;
            self.qualifier = self.qualifier
              .replace( '24hrs -', 'we are open until')
              .replace( 'Closed', 'we are closed :(');
          }

        });
      }

      /**
       * Based on known quantities in the json, we can streamline
       * the 24-hour dates
       */
      _setHours = function() {
        if ( !self.isException  ) {
          switch ( day ) {
            case 'Monday' :
            case 'Tuesday' :
            case 'Wednesday' :
            case 'Thursday' :
              self.open = true;
              self.qualifier = 'all day.';
              self.addMessage( 'On ' + date.format( 'dddd, MMM Do' ) + ', we are open ' + self.qualifier, 'bot' );
              break;
            case 'Friday' :
            case 'Saturday' :
            case 'Sunday' :
               _check( day );
               break;
          }
        } else {

          if ( date === self.tomorrow ) {
            self.addMessage( 'And tomorrow?', 'user' );
          }

          self.addMessage( 'On ' + date.format( 'dddd, MMM Do') + ', ' + self.qualifier, 'bot' );
        }
      }

      _getHours( date );

    },

    /**
     * A useful utility for returning objects matching known
     * values. We use this to match start dates.
     */
    getObjects : function(obj, key, val) {
        var objects = [];
        for (var i in obj) {
            if (!obj.hasOwnProperty(i)) continue;
            if (typeof obj[i] == 'object') {
                objects = objects.concat( this.getObjects(obj[i], key, val));
            } else
            //if key matches and value matches or if key matches and value is not passed (eliminating the case where key matches but passed value does not)
            if (i == key && obj[i] == val || i == key && val == '') { //
                objects.push(obj);
            } else if (obj[i] == val && key == ''){
                //only add if the object is not already in the array
                if (objects.lastIndexOf(obj) == -1){
                    objects.push(obj);
                }
            }
        }
        return objects;
    },


    init : function() {

      var self = this;

      this.ajax( 'http://web.library.emory.edu/using-the-library/visiting-the-library/hours/index.json' )
        .then( function( result ) {

          self.hours = JSON.parse( result );
          self.exceptions = self.hours.exceptions;
          self.areWeOpen();

        });

    },

    /**
     * @note Quirk of moments.js: every time you manipulate
     * a moment object, that value is cached. 
     */
    showSchedule : function() {

      var schedule  = this.hours.defaultHours,
          self      = this;

      self.addMessage( 'Show me the next 5 days', 'user' );
      self.addMessage( 'Here\'s our schedule for the next 5 days:', 'bot' );
      self.areWeOpen( self.now.add( 1, 'days' ) );
      self.areWeOpen( self.now.add( 1, 'days' ) );
      self.areWeOpen( self.now.add( 1, 'days' ) );
      self.areWeOpen( self.now.add( 1, 'days' ) );
      self.areWeOpen( self.now.add( 1, 'days' ) );
    }

  }
});
