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
const Color kGold = Color(0xFFF2B72A);
const Color kChar = Color(0xFF4A0A0E);
const Color kMaroonDark = Color(0xFF2E0508);
const Color kCream = Color(0xFFFFF7E6);

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
          gradient: RadialGradient(colors: [Color(0xFF7A1218), kMaroonDark], radius: 1.1),
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
                  child: Image.asset('assets/icon/app_icon.png', width: 170, height: 170),
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
    body{background:#fbf3e4!important}
    .topbar{background:linear-gradient(135deg,#2E0508,#6d0f16)!important;border-bottom:3px solid #F2B72A!important;padding:12px 14px!important;margin:0 -12px;border-radius:0 0 22px 22px;box-shadow:0 6px 16px rgba(74,10,14,.35)}
    .topbar b{color:#F2B72A!important;letter-spacing:1.5px;font-size:1.1em!important}
    .topbar small{color:#ffe9b8!important}
    .menu-btn{background:linear-gradient(145deg,#ffffff,#fff1d0)!important;border:1.5px solid rgba(242,183,42,.7)!important;border-radius:22px!important;box-shadow:0 8px 18px rgba(74,10,14,.18),inset 0 1px 0 #fff!important;color:#4A0A0E!important;transition:transform .15s,box-shadow .15s}
    .menu-btn:active{transform:scale(.94);box-shadow:0 2px 6px rgba(74,10,14,.25)!important}
    .menu-btn .ic{filter:drop-shadow(0 3px 3px rgba(0,0,0,.25))}
    .btn,.submit-btn{border-radius:16px!important;box-shadow:0 5px 12px rgba(74,10,14,.22)!important;font-weight:700!important}
    .submit-btn{background:linear-gradient(135deg,#ffd75e,#F2B72A,#c98f12)!important;color:#3a0609!important}
    .view{border-radius:22px!important;box-shadow:0 8px 18px rgba(74,10,14,.14)!important}
    .dash{padding-bottom:24px!important}
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
                  value: _progress / 100, minHeight: 3, color: kGold, backgroundColor: kMaroonDark),
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
      color: kCream,
      padding: EdgeInsets.fromLTRB(12, 8, 12, 4 + bottomInset),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF7A1218), kMaroonDark]),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: kGold, width: 1.6),
            boxShadow: [BoxShadow(color: kChar.withValues(alpha: 0.45), blurRadius: 16, offset: const Offset(0, 6))],
          ),
          child: Row(children: [
            _NavItem(icon: Icons.home_rounded, label: 'Home', onTap: onHome),
            _NavItem(icon: Icons.arrow_back_rounded, label: 'Back', onTap: onBack),
            _NavItem(icon: Icons.refresh_rounded, label: 'Refresh', onTap: onRefresh),
            _NavItem(icon: Icons.power_settings_new_rounded, label: 'Logout', onTap: onLogout, logout: true),
          ]),
        ),
        const SizedBox(height: 6),
        const _DevCredit(),
      ]),
    );
  }
}

class _NavItem extends StatefulWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool logout;
  const _NavItem({required this.icon, required this.label, required this.onTap, this.logout = false});
  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> {
  bool _down = false;
  @override
  Widget build(BuildContext context) {
    final grad = widget.logout
        ? const [Color(0xFFFF6B6B), Color(0xFFC62828)]
        : const [Color(0xFFFFE08A), Color(0xFFE0A21A)];
    final fg = widget.logout ? Colors.white : kMaroonDark;
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _down ? 0.86 : 1,
          duration: const Duration(milliseconds: 120),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: grad),
                boxShadow: [
                  BoxShadow(color: grad.last.withValues(alpha: 0.55), blurRadius: 10, offset: const Offset(0, 3)),
                ],
                border: Border.all(color: Colors.white.withValues(alpha: 0.7), width: 1.2),
              ),
              child: Icon(widget.icon, color: fg, size: 25),
            ),
            const SizedBox(height: 4),
            Text(widget.label,
                style: TextStyle(
                    color: widget.logout ? const Color(0xFFFFB4B4) : const Color(0xFFFFE9B8),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6)),
          ]),
        ),
      ),
    );
  }
}

/* "Developed by Avinash" - slide-in typing + shimmer animation */
class _DevCredit extends StatefulWidget {
  const _DevCredit();
  @override
  State<_DevCredit> createState() => _DevCreditState();
}

class _DevCreditState extends State<_DevCredit> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 4200))..repeat();

  static const String _txt = 'Developed by Avinash';

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (_, __) {
        final t = _c.value;
        // 0-0.35 typing, 0.35-0.85 hold with shimmer, 0.85-1 fade out
        final typed = (t / 0.35).clamp(0.0, 1.0);
        final n = (typed * _txt.length).round();
        final fadeOut = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1.0;
        final sh = ((t - 0.35) / 0.5).clamp(0.0, 1.0);
        return Opacity(
          opacity: fadeOut,
          child: Transform.translate(
            offset: Offset(0, (1 - typed) * 6),
            child: ShaderMask(
              blendMode: BlendMode.srcIn,
              shaderCallback: (r) => LinearGradient(
                colors: const [kChar, kGold, Color(0xFFB07A00), kGold, kChar],
                stops: const [0.0, 0.35, 0.5, 0.65, 1.0],
                begin: Alignment(-2 + 4 * sh, 0),
                end: Alignment(-1 + 4 * sh, 0),
                tileMode: TileMode.clamp,
              ).createShader(r),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.auto_awesome, size: 11, color: Colors.white),
                const SizedBox(width: 5),
                Text(_txt.substring(0, n),
                    style: const TextStyle(
                        fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 1.4, color: Colors.white)),
              ]),
            ),
          ),
        );
      },
    );
  }
}
