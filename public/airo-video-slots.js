;(function () {
  var SLOT_PREFIX_IMAGES = '/airo-assets/images/'
  var SLOT_PREFIX_VIDEOS = '/airo-assets/videos/'
  var mediaTypes = {}

  function extractSlotPath(url) {
    if (!url) return null
    var prefixes = [SLOT_PREFIX_IMAGES, SLOT_PREFIX_VIDEOS]
    for (var i = 0; i < prefixes.length; i++) {
      var idx = url.indexOf(prefixes[i])
      if (idx !== -1) {
        var after = url.substring(idx + prefixes[i].length)
        return after.split('?')[0]
      }
    }
    return null
  }

  function patchImg(img) {
    if (!img.src) return
    if (img.getAttribute('data-airo-video-patched')) return
    var slotPath = extractSlotPath(img.src)
    if (!slotPath || mediaTypes[slotPath] !== 'video') return

    var existing = img.parentNode && img.parentNode.querySelector('video[data-slot="' + slotPath + '"]')
    if (existing) existing.remove()

    var videoUrl = img.src.replace(SLOT_PREFIX_IMAGES, SLOT_PREFIX_VIDEOS)
    var video = document.createElement('video')
    video.src = videoUrl
    video.autoplay = true
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.className = img.className
    video.style.cssText = img.style.cssText
    if (img.width) video.width = img.width
    if (img.height) video.height = img.height
    video.setAttribute('data-airo-video', '')
    video.setAttribute('data-slot', slotPath)

    img.setAttribute('data-airo-video-patched', 'true')
    img.style.display = 'none'
    if (img.parentNode) {
      img.parentNode.insertBefore(video, img.nextSibling)
    }
  }

  function patchBgElement(el) {
    var bgImage = window.getComputedStyle(el).backgroundImage
    if (!bgImage || bgImage === 'none') return
    if (bgImage.indexOf(SLOT_PREFIX_IMAGES) === -1 && bgImage.indexOf(SLOT_PREFIX_VIDEOS) === -1) return
    var urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/)
    if (!urlMatch || !urlMatch[1]) return
    var slotPath = extractSlotPath(urlMatch[1])
    if (!slotPath || mediaTypes[slotPath] !== 'video') return

    if (el.getAttribute('data-airo-video-bg-patched') === slotPath) {
      el.style.backgroundImage = 'none'
      return
    }

    var existing = el.querySelector('video[data-airo-bg-video]')
    if (existing) existing.remove()

    el.style.backgroundImage = 'none'
    el.setAttribute('data-airo-video-bg-patched', slotPath)
    var videoUrl = urlMatch[1].replace(SLOT_PREFIX_IMAGES, SLOT_PREFIX_VIDEOS)
    if (videoUrl.indexOf(SLOT_PREFIX_VIDEOS) === -1) {
      videoUrl = SLOT_PREFIX_VIDEOS + slotPath
    }
    var video = document.createElement('video')
    video.src = videoUrl
    video.autoplay = true
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.setAttribute('data-airo-bg-video', '')
    video.setAttribute('data-slot', slotPath)
    video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;'
    var pos = window.getComputedStyle(el).position
    if (pos === 'static') el.style.position = 'relative'
    el.insertBefore(video, el.firstChild)
  }

  function patchAll() {
    document.querySelectorAll('img').forEach(patchImg)
    document.querySelectorAll('[style*="background"], [data-airo-video-bg-patched]').forEach(patchBgElement)
    var hasVideoSlots = false
    for (var k in mediaTypes) {
      if (mediaTypes[k] === 'video') { hasVideoSlots = true; break }
    }
    if (hasVideoSlots) {
      document.querySelectorAll('section, div, header, main, [class*="hero"], [class*="banner"], [class*="background"]').forEach(function (el) {
        if (!el.getAttribute('data-airo-video-bg-patched') && !el.hasAttribute('style')) {
          patchBgElement(el)
        }
      })
    }
  }

  fetch('/airo-media.json')
    .then(function (res) {
      if (!res.ok) return {}
      return res.json()
    })
    .then(function (manifest) {
      for (var key in manifest) {
        if (manifest[key] && manifest[key].mediaType) {
          mediaTypes[key] = manifest[key].mediaType
        }
      }
      patchAll()
      var isPatching = false
      var observer = new MutationObserver(function (mutations) {
        if (isPatching) return
        isPatching = true
        try {
        for (var i = 0; i < mutations.length; i++) {
          var mutation = mutations[i]
          if (mutation.type === 'childList') {
            var added = mutation.addedNodes
            for (var j = 0; j < added.length; j++) {
              var node = added[j]
              if (node instanceof HTMLImageElement) {
                patchImg(node)
              } else if (node instanceof HTMLElement) {
                node.querySelectorAll('img').forEach(patchImg)
                patchBgElement(node)
                node.querySelectorAll('[style*="background"]').forEach(patchBgElement)
              }
            }
          } else if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            var target = mutation.target
            if (target instanceof HTMLElement) {
              if (target.getAttribute('data-airo-video-bg-patched')) {
                var bg = target.style.backgroundImage
                if (bg && bg !== 'none' && (bg.indexOf(SLOT_PREFIX_IMAGES) !== -1 || bg.indexOf(SLOT_PREFIX_VIDEOS) !== -1)) {
                  target.removeAttribute('data-airo-video-bg-patched')
                  patchBgElement(target)
                }
              } else {
                patchBgElement(target)
              }
            }
          }
        }
        } finally {
          isPatching = false
        }
      })
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
      })

      var isDevMode = window.__AIRO_DEV_MODE__ === true || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      if (isDevMode) {
        var pollFailures = 0
        var pollIntervalId = setInterval(function () {
          fetch('/airo-media.json').then(function (r) {
            if (!r.ok) return {}
            return r.json()
          }).then(function (m) {
            pollFailures = 0
            var changed = false
            for (var k in m) {
              if (m[k] && m[k].mediaType && mediaTypes[k] !== m[k].mediaType) {
                mediaTypes[k] = m[k].mediaType
                changed = true
              }
            }
            if (changed) patchAll()
          }).catch(function (err) {
            pollFailures++
            if (pollFailures === 1) {
              console.warn('[airo-video-slots] manifest poll failed:', err.message || err)
            }
            if (pollFailures >= 5) {
              clearInterval(pollIntervalId)
            }
          })
        }, 3000)
      }
    })
    .catch(function () {
    })
})()