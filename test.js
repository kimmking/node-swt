var ffi = require('ffi'),
  ref = require('ref'),
  Struct = require('ref-struct'),
  hWnd = new Buffer(8);

var ICCx = Struct({
  'dwSize': 'int32',
  'dwICC': 'int32'
});
var ICCxPtr = ref.refType(ICCx);
var comctl32 = ffi.Library('comctl32', {
  'InitCommonControlsEx': ['int32', [ICCxPtr]]
});

var WndClassEx = Struct({
  'cbSize': 'uint32',
  'style': 'uint32',
  'lpfnWndProc': 'pointer', // callback 'int32', ['pointer', 'uint32', 'int32', 'uint32']
  'cbClsExtra': 'int32',
  'cbWndExtra': 'int32',
  'hInstance': 'pointer', // can be 0?
  'hIcon': 'pointer',
  'hCursor': 'pointer',
  'hbrBackground': 'pointer',
  'lpszMenuName': 'pointer',
  'lpszClassName': 'pointer',
  'hIconSm': 'pointer'
});
var WndClassExPtr = ref.refType(WndClassEx);
var user32 = ffi.Library('user32', {
  'RegisterClassExW': ['int32', [WndClassExPtr]],
  'CreateWindowExW': ['pointer', [
    'int32', 'pointer', 'pointer', 'int32',    // style, name, name, style
    'int32', 'int32', 'int32', 'int32',        // x, y, w, h
    'pointer', 'pointer', 'pointer', 'pointer' // handles
  ]],
  'DefWindowProcW': ['uint32', ['pointer', 'uint32', 'int32', 'pointer']],
  'ShowWindow': ['bool', ['pointer', 'int32']],
  'UpdateWindow': ['bool', ['pointer']],
  'GetMessageW': ['bool', ['pointer', 'pointer', 'uint32', 'uint32']],
  'TranslateMessageEx': ['bool', ['pointer']],
  'DispatchMessageW': ['uint32', ['pointer']],
  'PostQuitMessage': ['void', ['int32']]
});

var kernel32 = ffi.Library('kernel32', {
  'GetModuleHandleExW': ['bool', [
    'int32', 'pointer', 'pointer' // flags, optional LPCTSTR name, ref hModule
  ]], // etc... / kernel32 is your friend!
});
var gdi32 = ffi.Library('gdi32', {
  'CreateSolidBrush': ['pointer', [
    'int32' 
  ]],   
});

var Msg = Struct({
  'hwnd': 'pointer',
  'message': 'uint32',
  'wParam': 'int32',
  'lParam': 'pointer',
  'time': 'int32',
  'pX': 'int32',
  'pY': 'int32'
});

// App-specific

// Names
var className = new Buffer('Node.js WinForms Class\0', 'ucs-2');
var windowName = new Buffer('Node.js WinForms App\0', 'ucs-2');

// hInstance
var hInstance = new Buffer(8);
kernel32.GetModuleHandleExW(0, null, hInstance);

// WndProc
var WndProc = ffi.Callback('uint32',
  ['pointer', 'uint32', 'int32', 'pointer'],
  function(hwnd, uMsg, wParam, lParam) {
    console.log('Got Message: ' + uMsg + ' /', hwnd.deref());
    var result = 0; // ref.alloc('int32');
    switch(uMsg) {
      case 2:
        user32.PostQuitMessage(0);
        return 0;
      default:
        result = user32.DefWindowProcW(hwnd, uMsg, wParam, lParam);
        console.log('DefWindowProc LRESULT: ' + result);
        return result;
    }
    console.log('Sending LRESULT: ' + result.deref())
    return result;
  }
);

// Common Controls
var icc = new ICCx;
icc.dwSize = 8;
icc.dwICC = 0x40ff;
comctl32.InitCommonControlsEx(icc.ref());

// Window Class
var wClass = new WndClassEx;
wClass.cbSize = 48; //80; // x86 = 48
wClass.style = 3;
wClass.lpfnWndProc = WndProc;
wClass.cbClsExtra = 0;
wClass.cbWndExtra = 0;
wClass.hInstance = hInstance;
wClass.hIcon = null;
wClass.hCursor = null;
wClass.hbrBackground = gdi32.CreateSolidBrush(0xff8000);//null;
wClass.lpszMenuName = null;
wClass.lpszClassName = className;
wClass.hIconSm = null;

if (!user32.RegisterClassExW(wClass.ref()))
  throw 'Error registering class';

hWnd = user32.CreateWindowExW(
  0,
  className,
  windowName,
  0xcf0000, // overlapped window
  1 << 31, // use default
  1 << 31,
  320,
  200,
  null, null, hInstance, null
);

console.log(hWnd);

user32.ShowWindow(hWnd, 1);
user32.UpdateWindow(hWnd);

// message loop
var msg = new Msg;
var getMsgRes = 0;
while (user32.GetMessageW(msg.ref(), null, 0, 0)) {
  user32.TranslateMessageEx(msg.ref());
  user32.DispatchMessageW(msg.ref());
}

return msg.wParam;