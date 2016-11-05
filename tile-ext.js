// File tile-ext.js


/*
  ?? TODO: Unify with player.js
*/



(function (ext)
{
 // Constants
 const n_bytes_buffer = 1024;
 const n_caps = 4;

 
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
 
 

 // tuning values
 var cap_peak_init = 500;
 var cap_peak_min = 250;
 var cap_peak_max = 1000;
 var cap_on_frac = 0.25;
 var cap_off_frac = 0.20;



 // Class Tile
 
 function Tile ()
 {
  this.serial_device = null;
  this.out_buffer = new DataView (new ArrayBuffer (n_bytes_buffer));

  this.cap_raw_values = new Array (n_caps);
  this.cap_baselines = new Array (n_caps);
  this.cap_values = new Array (n_caps);
  this.cap_flags = new Array (n_caps);
  this.cap_peaks = new Array (n_caps);

  this.flag_event = false;
 }
  
 

 Tile.prototype . on_open =
 function ()
 {
  console.log ("on_open", this.serial_device.id);

  this.serial_device.set_receive_handler (this.on_data.bind (this));
  this.serial_device.send (to_buffer ("set_variable serial_ready 1 \n"));
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

    for (var i = 0; i < n_caps; i++)
     this.cap_count (i, Number (atoms [i + 2]));
   }
 }

 

 Tile.prototype . cap_count =
 function (index, value)
 {
  if (! isFinite (value))
   return;
  
  this.cap_raw_values [index] = value;
  
  if (this.cap_baselines [index] === undefined)
   {
    console.log ("cap_count: baseline", index, value);
    this.cap_baselines [index] = value;
   }

  if (this.cap_peaks [index] === undefined)
   {
    console.log ("cap_count: peak", index, cap_peak_init);
    this.cap_peaks [index] = cap_peak_init;
   }

  if (0)
   {
    // adjust downwards (originally faster tc)
    var tc = 500;

    if (value < this.cap_baselines [index])
     this.cap_baselines [index] =  (((1 / tc) * value) +
                                    (((tc - 1) / tc) * this.cap_baselines [index]) );

    // adjust upwards (originally slower tc)
    var tc = 500;

    if (value > this.cap_baselines [index])
     this.cap_baselines [index] = (((1 / tc) * value) +
                                   (((tc - 1) / tc) * this.cap_baselines [index]) );
   }
  
  this.cap_values [index] = Math.round (value - this.cap_baselines [index]);

  // ?? functions
  var cap_on = this.cap_peaks [index] * cap_on_frac;
  var cap_off = this.cap_peaks [index] * cap_off_frac;

  if (this.cap_values [index] > cap_on)
   {
    this.cap_flags [index] = true;

    // peak detect
    if (this.cap_values [index] > this.cap_peaks [index])
     this.cap_peaks [index] = this.cap_values [index];
   }
   
  if (this.cap_values [index] < cap_off)
   {
    this.cap_flags [index] = false;

    // slow adjust down
    var tc = 500;
    this.cap_peaks [index] = Math.round (((1 / tc) * this.cap_values [index]) +
                                   (((tc - 1) / tc) * this.cap_peaks [index]) );
   }

  this.cap_peaks [index] = limit (this.cap_peaks [index], cap_peak_min, cap_peak_max);
 }



 // Functions
 
 
 // _shutdown - cleanup when the extension is unloaded
 function _shutdown ()
 {
  console.log ("_shutdown");

  for (var key in tiles)
   {
    tiles [key] . serial_device.close ();
    tiles [key] . serial_device = null;
   }
 }



 // _getStatus - report missing hardware, plugin, or unsupported browser
 function _getStatus ()
 {
  var connected = true;

  if (Object.keys (tiles).length == 0)
   connected = false;

  else
   {
    for (var key in tiles)
     if (! tiles [key].serial_device)
      connected = false;
   }

  if (connected)
   return { status: 2, msg: "Connected" };
  else
   return { status: 1, msg: "Not Connected" };
 }

 
  
 function _deviceConnected (dev)
 {
  console.log ("_deviceConnected", dev);

  var index = null;

  switch (dev.id)
   {
   case "/dev/tty.usbmodem1816151":
    index = "0";
    break;

   case "/dev/tty.usbmodem1864781":
    index = "1";
    break;

   case "/dev/tty.usbmodem1865731":
    index = "2";
    break;
   }

  if (index != null)
   {
    // ?? TEMPORARY setup for any one tile, assigned to index 0
    // index = 0;
    
    tiles [index] = new Tile ();
    tiles [index].serial_device = dev;
   }

  // ?? open all the devices at once, otherwise ScratchX will not try next device

  // ?? TEMPORARY setup for any two tiles
  if (tiles [0] && tiles [1])
   {
    for (var key in tiles)
     tiles [key].serial_device.open ({ bitRate: 115200, stopBits: 0 },
                                     tiles [key].on_open.bind (tiles [key]) );
   }
 }



 function _deviceRemoved (dev)
 {
  console.log ("_deviceRemoved");

  for (key in tiles)
   {
    if (tiles [key].serial_device == dev)
     tiles [key].serial_device = null;
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

 

 function tile_segment_raw (tile_n, segment)
 {
  return (tiles [tile_n].cap_raw_values [Number (segment)]);
 }
  


 function tile_segment_pressure (tile_n, segment)
 {
  var value = tiles [tile_n].cap_values [Number (segment)];

  if (value < 0)
   return (0);
  else
   return (value);
 }
  


 function tile_pressure (tile_n)
 {
  var values = tiles [tile_n].cap_values;
  var sum = 0;
  for (var i = 0; i < n_caps; i++)
   sum += values [i];

  if (sum < 0)
   return (0);
  else
   return (sum);
 }
  


 function tile_segment_flag (tile_n, segment)
 {
  return (tiles [tile_n].cap_flags [Number (segment)]);
 }



 function tile_flag (tile_n)
 {
  for (var i = 0; i < n_caps; i++)
   {
    if (tiles [tile_n].cap_flags [i])
     return (true);
   }
  
  return (false);
 }



 function tile_flag_event (tile_n)
 {
  var result = false;

  // if tile_flag currently
  if (tile_flag (tile_n))
   {
    // ...and the event was not yet reported
    if (! tiles [tile_n].flag_event)
     {
      result = true;
      tiles [tile_n].flag_event = true;
     }
   }

  // no current flag, so reset event
  else
   tiles [tile_n].flag_event = false;

  return (result);
 }
 


 function set_rgb_color (tile_n, red, green, blue)
 {
  var red = 255 * red / 100;
  var green = 255 * green / 100;
  var blue = 255 * blue / 100;
  
  var command = (["set_leds", red, green, blue, 255, 255, "\n"] . join (" "));
  console.log (command);
  tiles [tile_n].serial_device.send (to_buffer (command));
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
  var command = (["set_leds", color.red, color.green, color.blue, 255, 255, "\n"]
                 .join (" ") );
  console.log (command);
  tiles [tile_n].serial_device.send (to_buffer (command));
 }
 

 
 function set_2_named_colors (tile_n, color_name_1, color_name_2, split)
 {
  var color_1 = color_components (color_name_1);
  var color_2 = color_components (color_name_2);

  var set_1_width = split;
  var set_2_width = 7 - split;
  
  var set_1_on = (1 << set_1_width) - 1;
  var set_2_on = (1 << set_2_width) - 1;

  set_2_on <<= split;
  
  // color_1
  var command = (["set_leds", color_1.red, color_1.green, color_1.blue,
                  set_1_on, set_1_on, "\n"] . join (" "));
  console.log (command);
  tiles [tile_n].serial_device.send (to_buffer (command));

  
  // color 2
  var command = (["set_leds", color_2.red, color_2.green, color_2.blue,
                  set_2_on, set_2_on, "\n"] . join (" "));
  console.log (command);
  tiles [tile_n].serial_device.send (to_buffer (command));
 }
 

 
 function set_chaser (tile_n, red, green, blue)
 {
  var red = 255 * red / 100;
  var green = 255 * green / 100;
  var blue = 255 * blue / 100;

  var delay = 100;
  var direction = 0;
  
  var command = (["set_led_chaser", red, green, blue, delay, direction, "\n"] . join (" "));
  console.log (command);
  tiles [tile_n].serial_device.send (to_buffer (command));
 }
 

 
 function reset_baselines (tile_n)
 {
  for (var i = 0; i < n_caps; i++)
   tiles [tile_n].cap_baselines [i] = tiles [tile_n].cap_raw_values [i];
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
   ["r", "tile %n segment %m.segment raw", "tile_segment_raw", 0, 0],
   ["r", "tile %n segment %m.segment pressure", "tile_segment_pressure", 0, 0],
   ["b", "tile %n segment %m.segment pressed", "tile_segment_flag", 0],
   
   ["b", "tile %n pressed", "tile_flag", 0],
   ["r", "tile %n pressure", "tile_pressure", 0],

   ["h", "when tile %n pressed", "tile_flag_event", 0],

   [" ", "speak %s", "speak", ""],

   [" ", "set tile %n to red %n green %n blue %n", "set_rgb_color", 0, 0, 0, 0],
   [" ", "set tile %n to %m.color_name", "set_named_color", 0, "Black"],

   [" ", "set tile %n to %m.color_name and %m.color_name split %n",
    "set_2_named_colors", 0, "Black", "Black", 3 ],

   [" ", "set tile %n chaser to red %n green %n blue %n", "set_chaser", 0, 0, 0, 0],

   [" ", "reset tile %n sensor", "reset_baselines", 0]
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

 ext.tile_segment_raw = tile_segment_raw;
 ext.tile_segment_pressure = tile_segment_pressure;
 ext.tile_segment_flag = tile_segment_flag;
 ext.tile_pressure = tile_pressure;
 ext.tile_flag = tile_flag;
 ext.tile_flag_event = tile_flag_event;
 
 ext.speak = speak;
 ext.set_rgb_color = set_rgb_color;
 ext.set_named_color = set_named_color;
 ext.set_2_named_colors = set_2_named_colors;
 ext.set_chaser = set_chaser;
 ext.reset_baselines = reset_baselines;
 
 
 
 // register the extension
 ScratchExtensions.register ("JumpSmart", descriptor, ext, { type: "serial" });

})
( {} ) ;



