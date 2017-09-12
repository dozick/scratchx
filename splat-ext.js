// File splat-ext.js


/*
  ?? TODO: Unify with player.js
*/

var EXT;

(function (ext)
{
 // ?? debugging
 EXT = ext;
 
 // Constants
 const n_bytes_buffer = 1024;
 
 const n_leds = 14;
 const all_leds = (1 << n_leds) - 1;

 

 // from https://en.wikipedia.org/wiki/Web_colors
 const color_table =
 [
  // ["White",     100,    100,    100],
  // ["Silver",    75,     75,     75 ],
     ["Gray",      50,     50,     50 ],
     ["Black",     0,      0,      0  ],
     ["Red",       100,    0,      0  ],
  // ["Maroon",    50,     0,      0  ],
     ["Yellow",    100,    100,    0  ],
  // ["Olive",     50,     50,     0  ],
     ["Lime",      0,      100,    0  ],
  // ["Green",     0,      50,     0  ],
     ["Aqua",      0,      100,    100],
  // ["Teal",      0,      50,     50 ],
     ["Blue",      0,      0,      100],
  // ["Navy",      0,      0,      50 ],
     ["Fuchsia",   100,    0,      100],
  // ["Purple",    50,     0,      50 ]
  ] ;

 
 
 // Variables
 var tiles = {};
 var device_connection_timer = null;
 
 

 // tuning values



 // Class Tile
 
 function Tile (dev)
 {
  this.serial_device = dev;
  this.out_buffer = new DataView (new ArrayBuffer (n_bytes_buffer));

  // instance vars
  this.id = dev.id;
  this.index = Object.keys (tiles).length;
  this.pressed = false;
  this.watchdog_timer = null;
 }
  
 

 Tile.prototype . on_open =
 function ()
 {
  console.log ("on_open", this.serial_device.id);
  this.id = this.serial_device.id;

  this.serial_device.set_receive_handler (this.on_data.bind (this));
  this.serial_device.send (to_buffer ("set_variable serial_ready 1 \n"));

  this.restart_watchdog ();
 }

 

 Tile.prototype . on_data =
 function (data)
 {
  var text = to_string (data);
  // console.log (text);
  
  var atoms = text.split (" ");

  if (atoms [0] == "smm")
   {
    if (atoms [1] == 0)
     console.log ("on_data", this.serial_device.id, atoms [1]);

    this.pressed = Number (atoms [2]);

    this.restart_watchdog ();
   }
 }

 

 Tile.prototype . restart_watchdog =
 function ()
 {
  if (this.watchdog_timer)
   clearTimeout (this.watchdog_timer);
  
  this.watchdog_timer = setTimeout (this.on_watchdog.bind (this), 1000);
 }



 Tile.prototype . on_watchdog =
 function ()
 {
  console.log ("on_watchdog: timeout for device", this.id);
  
  if (this.serial_device)
   {
    this.serial_device.close ();
    this.serial_device = null;
   }

  for (var key in tiles)
   if (tiles [key].id == this.id)
    delete (tiles [key]);
 }



 // Functions
 
 function get_n_splats ()
 {
  return (Object.keys (tiles).length);
 }


 
 function restart_device_connection_timer ()
 {
  if (device_connection_timer)
   clearTimeout (device_connection_timer);

  device_connection_timer = setTimeout (on_device_connection_timeout, 2000);
 }
 


 function on_device_connection_timeout ()
 {
  console.log ("on_device_connection_timeout");
  
  for (var key in tiles)
   tiles [key].serial_device.open ({ bitRate: 115200, stopBits: 0 },
                                   tiles [key].on_open.bind (tiles [key]) );
 }



  // _shutdown - cleanup when the extension is unloaded
 function _shutdown ()
 {
  console.log ("_shutdown");

  for (var key in tiles)
   {
    tiles [key].serial_device.close ();
    delete tiles [key];
   }
 }



 // _getStatus - report missing hardware, plugin, or unsupported browser
 function _getStatus ()
 {
  var connected = (get_n_splats () > 0);

  if (connected)
   return { status: 2, msg: "Connected" };
  else
   return { status: 1, msg: "Not Connected" };
 }

 
  
 function _deviceConnected (dev)
 {
  console.log ("_deviceConnected", dev);

  // ?? ScratchX will call _deviceConnected repeatedly on same device until open
  if (! tiles [dev.id])
   {
    tiles [dev.id] = new Tile (dev);

    // ?? wait to open all the devices at once, otherwise ScratchX will not try next device
    restart_device_connection_timer ();
   }
 }



 // ?? Note: This is not actually called for serial devices!  (See  Firmata library.)
 
 function _deviceRemoved (dev)
 {
  console.log ("_deviceRemoved");

  for (key in tiles)
   {
    if (tiles [key].serial_device == dev)
     delete tiles [key];
   }
 }



 
 function to_buffer (string)
 {
  return (Uint8Array.from (string, (s) => s.charCodeAt (0)));
 }
 

 
 function to_string (buffer)
 {
  return (String.fromCharCode.apply (null, new Uint8Array (buffer)));
 }


 
 function limit (value, min, max)
 {
  if (value < min)
   return (min);
  else if (value > max)
   return (max);
  else
   return (value);
 }

 

 function get_tile (index)
 {
  for (var key in tiles)
   {
    var tile = tiles [key];
    if (tile.index == index)
     return (tile);
   }
  return (null);
 }

 

 function is_pressed (tile_n)
 {
  return (get_tile (tile_n).pressed);
 }



 function set_rgb_color (tile_n, red, green, blue)
 {
  var red = 255 * red / 100;
  var green = 255 * green / 100;
  var blue = 255 * blue / 100;
  
  var command = (["set_leds", red, green, blue, all_leds, "\n"]
                 .join (" ") );
  console.log (command);
  get_tile (tile_n).serial_device.send (to_buffer (command));
 }
 

 
 function color_components (color_name)
 {
  var spec_list = color_table.filter (function (item) { return (item [0] == color_name); });
  var spec = spec_list [0];

  var red   = 255 * spec [1] / 100;
  var green = 255 * spec [2] / 100;
  var blue  = 255 * spec [3] / 100;

  return ({ red: red, green: green, blue: blue });
 }

 

 function set_named_color (tile_n, color_name)
 {
  var color = color_components (color_name);
  var command = (["set_leds", color.red, color.green, color.blue, all_leds, "\n"]
                 .join (" ") );
  console.log (command);
  get_tile (tile_n).serial_device.send (to_buffer (command));
 }
 

 
 function set_pixel_named_color (tile_n, pixel_n, color_name)
 {
  var color = color_components (color_name);
  var command = (["set_leds", color.red, color.green, color.blue, (1 << pixel_n), "\n"]
                 .join (" ") );
  console.log (command);
  get_tile (tile_n).serial_device.send (to_buffer (command));
 }
 

 
 // ?? consider using utterance.onend to add "speak until done"
 
 function speak (string)
 {
  var utterance = new SpeechSynthesisUtterance (string);
  speechSynthesis.cancel ();
  speechSynthesis.speak (utterance);
 }
  


 // Block and block menu descriptions
 var descriptor =
 {
  blocks:
  [
   ["h", "when splat %n pressed", "is_pressed", 0],
   ["b", "splat %n pressed", "is_pressed", 0],

   ["r", "number of splats", "get_n_splats"],

   [" ", "set splat %n to %m.color_name", "set_named_color", 0, "Black"],
   [" ", "set splat %n pixel %n to %m.color_name", "set_pixel_named_color", 0, 0, "Black"],

   // [" ", "set splat %n to red %n green %n blue %n", "set_rgb_color", 0, 0, 0, 0],

   [" ", "speak %s", "speak", ""]

   ],

  menus:
  {
   segment: [0, 1, 2, 3],
   color_name: color_table.map (function (item) { return (item [0]); })
  }
 };



 // export module properties
 ext._shutdown = _shutdown;
 ext._getStatus = _getStatus;
 ext._deviceConnected = _deviceConnected;
 ext._deviceRemoved = _deviceRemoved;

 ext.is_pressed = is_pressed;
 ext.get_n_splats = get_n_splats;
 
 ext.speak = speak;
 ext.set_rgb_color = set_rgb_color;
 ext.set_named_color = set_named_color;
 ext.set_pixel_named_color = set_pixel_named_color;
 


 // ?? debugging
 ext.tiles = tiles;

 
 // register the extension
 ScratchExtensions.register ("Unruly Splats", descriptor, ext, { type: "serial" });

})
( {} ) ;



