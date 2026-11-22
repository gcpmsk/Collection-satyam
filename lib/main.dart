import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

const String kSiteUrl = 'https://collection.satyamgold.com';
const String kSiteHost = 'collection.satyamgold.com';
const Color kGold = Color(0xFFD4AF37);
const Color kChar = Color(0xFF1E1A1D);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: kChar,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: kChar,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  runApp(const CollectionApp());
}

class CollectionApp extends StatelessWidget {
  const CollectionApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Satyam Collection',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: kGold, brightness: Brightness.dark),
        scaffoldBackgroundColor: kChar,
      ),
      home: const SplashScreen(),
    );
  }
}

/* ------------------------- SPLASH ------------------------- */
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..forward();

  @override
  void initState() {
    super.initState();
    Timer(const Duration(milliseconds: 2400), () {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 500),
        pageBuilder: (_, __, ___) => const WebShell(),
        transitionsBuilder: (_, a, __, child) => FadeTransition(opacity: a, child: child),
      ));
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scale = CurvedAnimation(parent: _c, curve: Curves.elasticOut);
    final fade = CurvedAnimation(parent: _c, curve: const Interval(0.4, 1, curve: Curves.easeIn));
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(colors: [Color(0xFF3A2F1A), kChar], radius: 1.1),
        ),
        child: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            ScaleTransition(
              scale: scale,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(32),
                  boxShadow: [BoxShadow(color: kGold.withValues(alpha: 0.45), blurRadius: 40, spreadRadius: 2)],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(32),
                  child: Image.asset('assets/icon/app_icon.png', width: 150, height: 150),
                ),
              ),
            ),
            const SizedBox(height: 28),
            FadeTransition(
              opacity: fade,
              child: const Column(children: [
                Text('SATYAM GOLD',
                    style: TextStyle(color: kGold, fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: 3)),
                SizedBox(height: 6),
                Text('COLLECTION', style: TextStyle(color: Colors.white54, fontSize: 13, letterSpacing: 6)),
              ]),
            ),
            const SizedBox(height: 36),
            const SizedBox(
                width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.5, color: kGold)),
          ]),
        ),
      ),
    );
  }
}

/* ------------------------- WEB SHELL ------------------------- */
const String _injectJs = r'''
(function(){
  if(window.__sgInj) return; window.__sgInj=1;
  function send(o){ try{ SGApp.postMessage(JSON.stringify(o)); }catch(e){} }
  function fromBlob(b,name){ var r=new FileReader(); r.onloadend=function(){ send({t:'file',name:name||'file',data:r.result}); }; r.readAsDataURL(b); }
  function fromUrl(u,name){
    if(!u) return;
    if(u.indexOf('data:')===0){ send({t:'file',name:name||'file',data:u}); return; }
    fetch(u).then(function(r){return r.blob();}).then(function(b){ fromBlob(b,name); }).catch(function(){});
  }
  var oc=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    var h=this.href||'';
    if(this.hasAttribute('download')||h.indexOf('blob:')===0){ fromUrl(h,this.getAttribute('download')||'file'); return; }
    return oc.apply(this,arguments);
  };
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a'):null; if(!a) return;
    var h=a.href||'';
    if(a.hasAttribute('download')||h.indexOf('blob:')===0){ e.preventDefault(); e.stopPropagation(); fromUrl(h,a.getAttribute('download')||'file'); }
  },true);
  var wo=window.open;
  window.open=function(u,t,f){
    if(u&&(u.indexOf('blob:')===0||u.indexOf('data:')===0)){ fromUrl(u,'Collection.pdf'); return null; }
    return wo.apply(window,arguments);
  };
  navigator.share=function(d){
    d=d||{};
    if(d.files&&d.files.length){ for(var i=0;i<d.files.length;i++){ fromBlob(d.files[i],d.files[i].name); } }
    else { send({t:'text',text:((d.title||'')+' '+(d.text||'')+' '+(d.url||'')).trim()}); }
    return Promise.resolve();
  };
  navigator.canShare=function(){return true;};
  var st=document.createElement('style');
  st.textContent=`
    #logoutBtn{display:none!important}
    body{background:#f1f3f9!important}
    .topbar{background:linear-gradient(135deg,#1E1A1D,#3a2f1a)!important;border-bottom:2px solid #D4AF37!important;padding:12px 14px!important;margin:0 -12px;border-radius:0 0 18px 18px}
    .topbar b{color:#D4AF37!important;letter-spacing:1.5px;font-size:1.1em!important}
    .topbar small{color:#e8dcc0!important}
    .menu-btn{background:linear-gradient(145deg,#ffffff,#eef0f8)!important;border:1px solid rgba(212,175,55,.45)!important;border-radius:20px!important;box-shadow:0 6px 14px rgba(30,26,29,.14),inset 0 1px 0 #fff!important;transition:transform .15s,box-shadow .15s}
    .menu-btn:active{transform:scale(.95);box-shadow:0 2px 6px rgba(30,26,29,.2)!important}
    .menu-btn .ic{filter:drop-shadow(0 3px 3px rgba(0,0,0,.2))}
    .btn,.submit-btn{border-radius:14px!important;box-shadow:0 4px 10px rgba(0,0,0,.18)!important;font-weight:700!important}
    .submit-btn{background:linear-gradient(135deg,#f3d567,#D4AF37,#b8922a)!important}
    .view{border-radius:20px!important;box-shadow:0 6px 16px rgba(30,26,29,.12)!important}
    .dash{padding-bottom:20px!important}
  `;
  document.head.appendChild(st);
})();
''';

class WebShell extends StatefulWidget {
  const WebShell({super.key});
  @override
  State<WebShell> createState() => _WebShellState();
}

class _WebShellState extends State<WebShell> {
  late final WebViewController _wc;
  int _progress = 0;
  bool _error = false;
  DateTime? _lastBack;

  @override
  void initState() {
    super.initState();
    _wc = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(kChar)
      ..addJavaScriptChannel('SGApp', onMessageReceived: _onMsg)
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) => setState(() => _progress = p),
        onPageStarted: (_) => setState(() => _error = false),
        onPageFinished: (_) => _wc.runJavaScript(_injectJs),
        onWebResourceError: (e) {
          if (e.isForMainFrame ?? true) setState(() => _error = true);
        },
        onNavigationRequest: (req) {
          final uri = Uri.tryParse(req.url);
          if (uri == null) return NavigationDecision.navigate;
          if (uri.scheme == 'blob' || uri.scheme == 'data' || uri.scheme == 'about') {
            return NavigationDecision.navigate;
          }
          if ((uri.scheme == 'http' || uri.scheme == 'https') && uri.host == kSiteHost) {
            return NavigationDecision.navigate;
          }
          launchUrl(uri, mode: LaunchMode.externalApplication);
          return NavigationDecision.prevent;
        },
      ))
      ..loadRequest(Uri.parse(kSiteUrl));
  }

  Future<void> _onMsg(JavaScriptMessage m) async {
    try {
      final o = jsonDecode(m.message) as Map<String, dynamic>;
      if (o['t'] == 'text') {
        await Share.share(o['text'] as String);
        return;
      }
      final data = o['data'] as String;
      final comma = data.indexOf(',');
      final meta = data.substring(0, comma);
      final bytes = base64Decode(data.substring(comma + 1));
      final mime = RegExp(r'data:([^;]+)').firstMatch(meta)?.group(1) ?? 'application/octet-stream';
      var name = (o['name'] as String).replaceAll(RegExp(r'[^\w\.\-]'), '_');
      if (!name.contains('.')) {
        name += mime.contains('pdf') ? '.pdf' : (mime.contains('png') ? '.png' : '');
      }
      final dir = await getTemporaryDirectory();
      final f = File('${dir.path}/$name');
      await f.writeAsBytes(bytes);
      await Share.shareXFiles([XFile(f.path, mimeType: mime)], subject: name);
    } catch (e) {
      _snack('File error: $e');
    }
  }

  void _snack(String s) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s)));
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: kChar,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20), side: const BorderSide(color: kGold, width: 1)),
        title: const Text('Logout', style: TextStyle(color: kGold)),
        content: const Text('Kya aap logout karna chahte hain?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Nahi')),
          FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Haan, Logout')),
        ],
      ),
    );
    if (ok == true) {
      await _wc.runJavaScript("var b=document.getElementById('logoutBtn'); if(b) b.click();");
    }
  }

  Future<void> _onBack() async {
    if (await _wc.canGoBack()) {
      await _wc.goBack();
      return;
    }
    final now = DateTime.now();
    if (_lastBack == null || now.difference(_lastBack!) > const Duration(seconds: 2)) {
      _lastBack = now;
      _snack('Bahar jane ke liye dobara Back dabayein');
    } else {
      SystemNavigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _onBack();
      },
      child: Scaffold(
        backgroundColor: kChar,
        body: SafeArea(
          bottom: false,
          child: Column(children: [
            if (_progress < 100)
              LinearProgressIndicator(
                  value: _progress / 100, minHeight: 3, color: kGold, backgroundColor: Colors.black26),
            Expanded(
              child: Stack(children: [
                WebViewWidget(controller: _wc),
                if (_error) _ErrorView(onRetry: () => _wc.loadRequest(Uri.parse(kSiteUrl))),
              ]),
            ),
            _BottomBar(
              onHome: () => _wc.loadRequest(Uri.parse(kSiteUrl)),
              onRefresh: () => _wc.reload(),
              onBack: () async {
                if (await _wc.canGoBack()) _wc.goBack();
              },
              onLogout: _logout,
            ),
          ]),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorView({required this.onRetry});
  @override
  Widget build(BuildContext context) {
    return Container(
      color: kChar,
      width: double.infinity,
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Icon(Icons.wifi_off_rounded, color: kGold, size: 70),
        const SizedBox(height: 16),
        const Text('Internet connection nahi hai',
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 20),
        FilledButton.icon(
          style: FilledButton.styleFrom(backgroundColor: kGold, foregroundColor: kChar),
          onPressed: onRetry,
          icon: const Icon(Icons.refresh),
          label: const Text('Dobara koshish karein'),
        ),
      ]),
    );
  }
}

/* ------------------------- BOTTOM BAR ------------------------- */
class _BottomBar extends StatelessWidget {
  final VoidCallback onHome, onRefresh, onBack, onLogout;
  const _BottomBar({required this.onHome, required this.onRefresh, required this.onBack, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF2B2429), kChar]),
        border: Border(top: BorderSide(color: kGold, width: 1.5)),
        boxShadow: [BoxShadow(color: Colors.black54, blurRadius: 12, offset: Offset(0, -3))],
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 2),
          child: Row(children: [
            _NavItem(icon: Icons.home_rounded, label: 'Home', onTap: onHome),
            _NavItem(icon: Icons.arrow_back_rounded, label: 'Back', onTap: onBack),
            _NavItem(icon: Icons.refresh_rounded, label: 'Refresh', onTap: onRefresh),
            _NavItem(icon: Icons.power_settings_new_rounded, label: 'Logout', onTap: onLogout, color: const Color(0xFFFF6B6B)),
          ]),
        ),
        const _DevCredit(),
      ]),
    );
  }
}

class _NavItem extends StatefulWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  const _NavItem({required this.icon, required this.label, required this.onTap, this.color = kGold});
  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> {
  bool _down = false;
  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _down ? 0.88 : 1,
          duration: const Duration(milliseconds: 120),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                color: widget.color.withValues(alpha: _down ? 0.3 : 0.12),
                border: Border.all(color: widget.color.withValues(alpha: 0.5)),
              ),
              child: Icon(widget.icon, color: widget.color, size: 24),
            ),
            const SizedBox(height: 3),
            Text(widget.label,
                style: TextStyle(color: widget.color, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
          ]),
        ),
      ),
    );
  }
}

/* "Developed by Avinash" - shimmer + fade animation */
class _DevCredit extends StatefulWidget {
  const _DevCredit();
  @override
  State<_DevCredit> createState() => _DevCreditState();
}

class _DevCreditState extends State<_DevCredit> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 2600))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 5, top: 2),
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, __) {
          final t = _c.value;
          final pulse = 0.65 + 0.35 * (1 - (2 * t - 1).abs());
          return Opacity(
            opacity: pulse,
            child: ShaderMask(
              blendMode: BlendMode.srcIn,
              shaderCallback: (r) => LinearGradient(
                colors: const [Colors.white38, kGold, Colors.white, kGold, Colors.white38],
                stops: const [0.0, 0.35, 0.5, 0.65, 1.0],
                begin: Alignment(-2 + 4 * t, 0),
                end: Alignment(-1 + 4 * t, 0),
                tileMode: TileMode.clamp,
              ).createShader(r),
              child: const Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.code_rounded, size: 11, color: Colors.white),
                SizedBox(width: 4),
                Text('Developed by Avinash',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.2, color: Colors.white)),
              ]),
            ),
          );
        },
      ),
    );
  }
}
