/* ══════════════════════════════
   LANGUAGE SELECTOR
══════════════════════════════ */
;(function () {
  const selector = document.getElementById('langSelector')
  const trigger  = document.getElementById('langTrigger')
  const menu     = document.getElementById('langMenu')
  const flagEl   = document.getElementById('langCurrentFlag')
  const nameEl   = document.getElementById('langCurrentName')

  // Build menu items
  LANGUAGES.forEach(({ code, name, flag }) => {
    const opt = document.createElement('div')
    opt.className = 'lang-opt'
    opt.setAttribute('role', 'option')
    opt.dataset.code = code
    opt.innerHTML = `<span class="lang-opt-flag">${flag}</span><span>${name}</span>`
    opt.addEventListener('click', () => { setLang(code); closeMenu() })
    menu.appendChild(opt)
  })

  function openMenu() {
    selector.classList.add('open')
    trigger.setAttribute('aria-expanded', 'true')
  }
  function closeMenu() {
    selector.classList.remove('open')
    trigger.setAttribute('aria-expanded', 'false')
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation()
    selector.classList.contains('open') ? closeMenu() : openMenu()
  })

  document.addEventListener('click', closeMenu)
  menu.addEventListener('click', (e) => e.stopPropagation())

  window.setLang = function (lang) {
    const dict = T[lang] || T['en']
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n')
      if (dict[key] !== undefined) el.innerHTML = dict[key]
    })
    // Update selector display
    const langObj = LANGUAGES.find((l) => l.code === lang) || LANGUAGES.find((l) => l.code === 'en')
    if (flagEl) flagEl.textContent = langObj.flag
    if (nameEl) nameEl.textContent = langObj.name
    // Mark active
    menu.querySelectorAll('.lang-opt').forEach((o) => {
      o.classList.toggle('active', o.dataset.code === lang)
    })
    // RTL support
    document.documentElement.setAttribute('lang', lang)
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
    localStorage.setItem('gtf-lang', lang)
  }

  // Auto-detect
  const saved   = localStorage.getItem('gtf-lang')
  const browser = (navigator.language || '').split('-')[0].toLowerCase()
  const supported = LANGUAGES.map((l) => l.code)
  const detected  = saved || (supported.includes(browser) ? browser : 'en')
  setLang(detected)
})()

/* ══════════════════════════════
   REVEAL ON SCROLL
══════════════════════════════ */
;(function () {
  const revealObserver = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target) } }),
    { threshold: 0.08 }
  )
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el))
})()

/* ══════════════════════════════
   CONTINENT SVG RENDERING
   File format: { continent: string, shapes: [{type, coordinates}, ...] }
   Each shape is a GeoJSON geometry (Polygon or MultiPolygon)
══════════════════════════════ */
;(function () {
  const continents = [
    { id: 'africa',    file: 'assets/shapes/continents/africa.json' },
    { id: 'americas',  file: 'assets/shapes/continents/americas.json' },
    { id: 'asia',      file: 'assets/shapes/continents/asia.json' },
    { id: 'europe',    file: 'assets/shapes/continents/europe.json' },
    { id: 'oceania',   file: 'assets/shapes/continents/oceania.json' },
    { id: 'antarctic', file: 'assets/shapes/continents/antarctic.json' },
  ]

  function getShapes(data) {
    // Custom format: { continent, shapes: [{type, coordinates}] }
    if (Array.isArray(data.shapes)) return data.shapes
    // Standard GeoJSON FeatureCollection fallback
    if (data.type === 'FeatureCollection') return data.features.map((f) => f.geometry).filter(Boolean)
    if (data.type === 'Feature') return [data.geometry]
    return [data]
  }

  function collectBounds(shapes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    function scanRing(ring) {
      for (const [lng, lat] of ring) {
        if (lng < minX) minX = lng; if (lng > maxX) maxX = lng
        if (lat < minY) minY = lat; if (lat > maxY) maxY = lat
      }
    }
    function scanGeom(g) {
      if (!g) return
      if (g.type === 'Polygon')           g.coordinates.forEach(scanRing)
      else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => poly.forEach(scanRing))
    }
    shapes.forEach(scanGeom)
    return [minX, minY, maxX, maxY]
  }

  function project(coords, minX, minY, scale, offX, offY, H) {
    return coords.map(([lng, lat]) => [
      (lng - minX) * scale + offX,
      H - (lat - minY) * scale - offY,
    ])
  }

  function ringToPath(coords) {
    return coords.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt[0].toFixed(2)},${pt[1].toFixed(2)}`).join(' ') + ' Z'
  }

  function renderContinent(svgEl, wrap, data) {
    const W = 200, H = 140
    const shapes = getShapes(data)
    const [minX, minY, maxX, maxY] = collectBounds(shapes)
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    const scale  = Math.min(W / rangeX, H / rangeY) * 0.88
    const offX   = (W - rangeX * scale) / 2
    const offY   = (H - rangeY * scale) / 2

    const parts = []
    function addGeom(g) {
      if (!g) return
      if (g.type === 'Polygon') {
        g.coordinates.forEach((ring) => parts.push(ringToPath(project(ring, minX, minY, scale, offX, offY, H))))
      } else if (g.type === 'MultiPolygon') {
        g.coordinates.forEach((poly) =>
          poly.forEach((ring) => parts.push(ringToPath(project(ring, minX, minY, scale, offX, offY, H))))
        )
      }
    }
    shapes.forEach(addGeom)

    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', parts.join(' '))
    path.setAttribute('fill', 'currentColor')
    path.setAttribute('fill-rule', 'evenodd')
    svgEl.appendChild(path)
    wrap.classList.remove('loading')
  }

  continents.forEach(({ id, file }) => {
    const svgEl = document.getElementById('svg-' + id)
    const wrap  = document.getElementById('svg-wrap-' + id)
    if (!svgEl || !wrap) return
    fetch(file)
      .then((r) => r.json())
      .then((data) => renderContinent(svgEl, wrap, data))
      .catch(() => wrap.classList.remove('loading'))
  })
})()
