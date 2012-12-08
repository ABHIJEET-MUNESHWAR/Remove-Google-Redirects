// ==UserScript==
// @license		GPL v3 or later version
// @include		*://www.google.*/*q=*
// @include		*://www.google.*/*url=*
// @include		*://www.google.*/*tbs=*
// @include		*://www.google.*/search?*
// @include		*://www.google.*/webhp?*
// @include		*://www.google.*/?*
// @include		*://www.google.*/#*
// @include		*://www.google.*/
// @include		*://encrypted.google.*
// @include		*://ipv6.google.*
// @include		*://www.google.*/news*
// @include		*://news.google.*/*
// @include		*://books.google.*/*
// @include		*://plus.google.com/*
// @include		*://plus.url.google.com/*
// @include		*://plus.url.google.com/*url=*
// @include		*://plus.url.google.com/url?*
// @include		*://images.google.com/*
// @include		*://docs.google.com/*
// @include		*://maps.google.com/*
// @include		*://www.google.com/maps*
// @include		*://ditu.google.com/*
// @include		*://play.google.com/*
// @include		*://groups.google.com/group/*
// @include		*://www.google.com/bookmarks/*
// @include		*://www.google.com/history/*
// @include		*://www.google.com/prdhp*
// @include		*://www.google.com/products/catalog?*
// @include		*://www.google.com/shopping/offerdetails?*

// @run-at         document-start
// ==/UserScript==

(function ($$d) {
	// document URI
	var $$url = null;
	urlHashchange();

	// unsafe window
	var $$w = null;
	
	// get unsafeWindow
	var injectWindow = (function () {
	var retry = 0;
	return function ($var, $func, $testFunc) {
		if (!$$w) {
			// load unsafeWindow
			if (typeof(unsafeWindow) !== "undefined" && typeof(unsafeWindow[$var]) !== "undefined")
				$$w = unsafeWindow;
			else if (typeof(window[$var]) !== "undefined")
				$$w = window;
			else
				try {
					// for Chrome
					var a = document.createElement("a");
					a.setAttribute("onclick", "return window;");
					var win = a.onclick();
					if (typeof(win[$var]) !== "undefined")
						$$w = win;
				} catch (e) {}
		}
		if ($$w && (($testFunc && $testFunc($$w)) || !$testFunc))
			return $func();
		// if window loading is not successful, retry for 12000ms
		if (++retry<40)
			setTimeout((function ($v, $f, $t) {
				return function () { injectWindow($v, $f, $t); };
				})($var, $func, $testFunc), 300);
	}
	})();
	
	// for each
	function each($arr, $fun) {
		if (!$arr)
			return;
		//console.debug('each function is called. arr length is '+ $arr.length);
		if (typeof $arr == 'string')
			$arr = $$d.querySelectorAll($arr);
		for (var i=$arr.length-1; i >=0; i--)
			$fun.call($arr[i]);
	}
	
	function urlHashchange() {
		var url = $$d.location.href;
		// turn http://xxx.xxx into http://xxx.xxx/
		if (/^https?:\/\/[\w.]+\w+$/.test(url))
			url += '/';
		if ($$url != url) {
			$$url = url;
			console.debug('Straight Google - Current URL : '+ $$url);
			return true;
		}
		else
			return false;
	}

	var onUrlHashchange = (function () {
		var queue = [];
		// mointer
		setInterval(function () {
			if (urlHashchange())
				for (var i=0; i<queue.length; i++)
					queue[i]();
		}, 500);
		return function ($func, $init) {
			queue.push($func);
			if ($init)
				$func();
		};
	})();
	
	// expand goo.gl shorten url
	function expand_short_url($url, $callback) {
		if (!/^(?:https?:\/\/)?goo\.gl\/\w+$/.test($url))
			return;
		var api = "https://www.googleapis.com/urlshortener/v1/url?shortUrl={$url}";
		// query Google Shorten URL API
		console.debug('Straight Google : trying to expand shorten URL ['+ $url +']');
		GM_xmlhttpRequest({
			method : 'GET',
			url : api.replace('{$url}', /^https?:\/\//.test($url) ? $url : 'http://'+ $url),
			onload : (function ($f) {
				return function (res) {
					try {
						eval('var obj = '+ res.responseText);
					} catch (e) {
						return;
					}
					if (obj.status != "OK")
						return;
					console.debug('Straight Google : shorten URL expanded ['+ obj.longUrl +']');
					// call back
					$f(obj.longUrl);
				};
			})($callback),
			onerror : function (res) {
				console.debug('Straight Google : fail to expand shorten URL ['+ res.finalUrl +']');
			}
		});
	}
	
	// fetch Google Redirection Traget
	function get_google_url($url, $urlType) {
		if (!$url)
			return;
		var google_url_reg = null;
		// for Google Image Redirection
		switch ($urlType) {
			case 1 : // image reference url
				google_url_reg = /^(?:https?:\/\/.+\.google\..+)?\/imgres\?(?:(?!imgrefurl)\w+=[^&]*&)*(?:imgrefurl)=((?:https?(?::\/\/|%3A%2F%2F))?[^&]+).*$/i;
				break;
			default :
				google_url_reg = /^(?:https?:\/\/.+\.google\..+)?\/(?:(?:local_)?url|imgres)\?(?:(?!url|q|imgurl)\w+=[^&]*&)*(?:url|q|imgurl)=((?:https?(?::\/\/|%3A%2F%2F))?[^&]+).*$/i;
		}
		var mat = $url.match(google_url_reg); 
		var res = mat ? unescape(mat[1] || '') : '';
		// fix http://
		if (res && !/^https?:\/\//.test(res))
			res = "http://"+ res;	// default http
		return res;
	}
	
	function google_url_clean() {
		var url = get_google_url(this.href);
		if (url) {
			this.href = url;
			console.debug('Redirection of ['+ url +'] is now removed.');
		}
		do_not_track.call(this);
		// try to expand shorten url
		expand_short_url(url || this.href, (function (obj) {
			return function (url) {
				if (obj) obj.href = url;
			};
		})(this));
		return url || '';
	}
	
	function common_clean_job() {
		listen('a[href*="/url?"]', null, google_url_clean, true);	// this applys for static pages
	}
	
	function do_not_track() {
		// add no follow
		if (!this.getAttribute("rel")) this.setAttribute("rel", "noreferrer");
	}
	
	// listen to specific event
	var listen = (function () {
		var interval_count=[];
		return function ($selector, $event, $func, $init, $runOnce) {
			// $event & $init cannot be false at the same time
			if (!$event && !$init)
				return;
			var evt_listener = (function ($s, $e, $f, $i, $r) {
				var id = interval_count.length;
				return function () {
					// if $s is a element itself
					var dom = (typeof $s == 'string') ? $$d.querySelectorAll($s) : $s;
					if (dom.length > 0) {
						//console.debug('Straight Google: '+ dom.length +' elements of ['+ $s +'] is captured.');
						clearInterval(interval_count[id]);
						delete interval_count[id];
						for (var i=0; i<dom.length; i++) {
							// if the function need initiation
							if ($i) $f.call(dom[i]);
							if ($e instanceof Array)
								each(
									$e,
									function () {
										dom[i].addEventListener(this, (function ($d, $evt) {
											var newF = function () {
												$f.apply($d, Array.prototype.slice.apply(arguments));
												$d.removeEventListener($evt, newF);
											}
											return $r ? newF : $f;
											})(dom[i], this)
										);
									}
								);
							else if ($e)	// when $e != null
								dom[i].addEventListener($e, (function ($d, $evt) {
									var newF = function () {
										// in case the element has been removed
										if (!$d)
											return;
										$f.apply($d, Array.prototype.slice.apply(arguments));
										$d.removeEventListener($evt, newF);
									}
									return $r ? newF : $f;
									})(dom[i], $e)
								);
							else	// do nothing
								;
						}
					}
				}
			})($selector, $event, $func, $init, $runOnce);
			interval_count.push(setInterval(evt_listener, 500));
		}
	})();

	// Main part begin ========================================
	// prevent Google Plus redirection : plus.url.google.com
	if (/:\/\/plus\.google\.com\/.*$/.test($$url)) {
		console.debug('Straight Google [Plus] is now loaded');
		function plus_clean() {
			each(
				// use 'do not track me' feature
				'a.ot-anchor:not([rel])',
				google_url_clean
			);
		}
		// notification bar
		if (/\/notifications\/frame\?/.test($$url)) {
			// plus home page
			injectWindow("OZ_initData", function () {
				$$w.OZ_initData["1"][20]="";
				console.debug('URL Redirection of Google Plus Notification is now prevented.');
			});
			listen(
				// notification stream
				'div.kd.GtHf1e', "DOMSubtreeModified", plus_clean, true
			);
		}
		else if (/\/apps-static\//.test($$url)) {}
		else {
			// plus home page
			injectWindow("AF_initDataQueue", function () {
				for (var i=0, q = $$w.AF_initDataQueue; i<q.length; i++)
					if (q[i].key=="1") {
						q[i].data[20]="";	// clear plus.url.google.com
						console.debug('URL Redirection of Google Plus is now prevented.');
						break;
					}
			});
			// listen to the stream
			function _bind_stream() {
				listen(
					"div.lzqA1d", "DOMNodeInserted", plus_clean
				);
			}
			
			// page switch
			onUrlHashchange(_bind_stream, true);
		}
	}
	// remove google news redirection here
	else if (/:\/\/news\.google\.[\w.]+\w\/.*$/.test($$url) || /:\/\/www\.google\.[\w.]+\w\/news\/.*$/.test($$url)) {
		console.debug('Straight Google [News] is now loaded');
		listen(
			'.blended-section',
			"DOMNodeInserted", 
			function () {
					each(
						'a.article[url]:not(._tracked)',
						function () {
							// fix link to its normal url
							this.href = this.getAttribute('url');
							do_not_track.call(this);
							console.debug("Redirection of ["+ this.href +"] is now removed.");
							// cheat google and say "it has been tracked already"
							this.className += ' _tracked';
						}
					);
			},
			true
		);
	}

	// remove google play redirection here
	else if (/:\/\/play\.google\.com\/store\/.+/.test($$url)) {
		console.debug('Straight Google [Play] is now loaded');
		common_clean_job();
	}

	// remove google books redirection here
	else if (/:\/\/books\.google\.[\w.]+\w\/.*$/.test($$url)) {
		console.debug('Straight Google [Books] is now loaded');
		common_clean_job();
	}

	// Google Drive
	else if (/:\/\/docs\.google\.com\/.+/.test($$url)) {
		console.debug('Straight Google [Drive] is now loaded');
		// Spread Sheet
		if (/docs\.google\.com\/spreadsheet\/.+/.test($$url))
			listen('a.docs-bubble-link[target="_blank"]', 'mouseover', google_url_clean);
		// Other products
		else if (/docs\.google\.com\/(document|presentation|drawings)\/.+/.test($$url))
			listen('div.docs-bubble a[target="_blank"]', 'mouseover', google_url_clean);
	}
	// Google Maps
	else if (/:\/\/(ditu|maps)\.google\.com\/.*$/.test($$url) || /:\/\/www\.google\.com\/maps(\?|\/).*$/.test($$url)) {
		console.debug('Straight Google [Maps] is now loaded');
		var match_pattern = 'div#resultspanel a[href*="/local_url?"]';
		// inject as a local function when output is js
		if (/output=js/.test($$url))
			injectWindow('w', function () {
				if (!$$w.w.loadVPage)
					return;
				// select parent window's elements
				listen($$w.w.document.querySelectorAll(match_pattern), null, google_url_clean, true);
			});
		else
			listen(match_pattern, null, google_url_clean, true);
	}
	// Google Groups
	else if (/:\/\/groups\.google\.com\/(forum|group)\/.+/.test($$url)) {
		console.debug('Straight Google [Groups] is now loaded');
		// for old Google Groups template
		if (/groups\.google\.com\/group\/.+/.test($$url))
			common_clean_job();
	}
	// Google Bookmarks
	else if (/:\/\/www\.google\.com\/bookmarks\/.*$/.test($$url)) {
		console.debug('Straight Google [Bookmarks] is now loaded');
		listen('table.result a[id^="bkmk_href_"]', null, google_url_clean, true);
	}
	// Google Web History
	else if (/:\/\/www\.google\.com\/history\/.*$/.test($$url)) {
		console.debug('Straight Google [Web History] is now loaded');
		common_clean_job();
	}
	// Google Image Search
	else if (/:\/\/(www|encrypted|ipv6)\.google\.[\w.]+\w\/(imghp\?.+|search(\?|#)(.+&)*tbm=isch(&.+)*)$/.test($$url)) {
		console.debug('Straight Google [Image] is now loaded');
		var refUrl = 'ref-url';
		function img_search_clean() {
			// before expanding
			each(
				'#ires a.rg_l[href*="/imgres?"]',
				function () {
					this.setAttribute(refUrl, this.href);	// straight google - url
					google_url_clean.call(this);
				}
			);
			// for Image links
			var cur_expanded = $$d.querySelector('div#rg_h[data-initialized="1"]');
			if (!cur_expanded)
				return;
			var span = cur_expanded.querySelector('.rg_hr span#rg_hr');
			var rg_hta = cur_expanded.querySelector('#rg_ht a#rg_hta');
			var clean_href = rg_hta.href;
			var rg_l = $$d.querySelector('#ires a.rg_l[href="'+ clean_href +'"]['+ refUrl +']');
			if (!clean_href || !rg_l)
				return;
			var ref_url = rg_l.getAttribute(refUrl);
			rg_hta.href = get_google_url(ref_url, 1);
			if (!span)
				return;
			var a = $$d.createElement('a');
			a.innerText = span.innerText;	// copy link
			a.href = 'http://'+ a.innerText;
			var link = $$d.createElement('a');
			link.href = ref_url;
			link.innerText = '[link]';
			span.innerHTML = '';
			span.appendChild(a);
			// two space
			span.appendChild($$d.createTextNode('\u00a0\u00a0'));
			span.appendChild(link);
		}
		// text css style
		GM_addStyle('.rg_hr span#rg_hr a{ color: #093; white-space: nowrap; text-decoration: none; }');
		listen("#ires", "mousemove", img_search_clean, true);
	}
	// Google Shopping
	else if (/:\/\/www\.google\.com\/(products\/catalog\?|shopping\/offerdetails\?|prdhp).*/.test($$url)) {
		console.debug('Straight Google [Shopping] is now loaded');
		common_clean_job();
		// Show All # function
		if (/\/products\/catalog\?/.test($$url))
			injectWindow('showPlusBox', (function () {
				var originFunc = null;
				return function () {
					originFunc = $$w.showPlusBox;
					$$w.showPlusBox = function () {
						originFunc.apply(this, Array.prototype.slice.apply(arguments));
						common_clean_job();
					}
				};
			})());
	}
	// Google Web Search
	else if (/:\/\/(www|encrypted|ipv6)\.google\.[\w.]+\w\/(search|webhp\?.+|(search|webhp)?(\?|#)(.+&)*(q|tbs|as_q)=.+)?$/.test($$url)) {
		console.debug('Straight Google [Web Search] is now loaded');

		function search_clean() {
			each(
				'#ires a.l[href][onmousedown]',
				function () {
					google_url_clean.call(this);
					this.removeAttribute('onmousedown');
					//console.debug("Click event of link ["+ this.href +"] is now removed.");
				}
			);
			// image redirection
			each(
				'#ires a[href^="/url?"]',
				google_url_clean
			);
		}
		
		// do a deep clean, kill the rwt function
		injectWindow('rwt', function () {
			$$w.rwt = function ($_self) {
				google_url_clean.call($_self);
				$_self.removeAttribute('onmousedown');
				return true;
			};
			// for Google Instant
			$$w.addEventListener('hashchange', search_clean);
		}, function (w) {
			return /google/i.test(''+ w['rwt']);
		});
		
		// be cool with AutoPager
		listen("#navcnt", "DOMNodeInserted", search_clean, true);
	}
	
})(document);