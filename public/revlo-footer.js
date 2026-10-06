(() => {
  // Site footer for the app shell. Lives outside #root so React re-renders never remove it.
  if (document.querySelector('.revlo-site-footer')) return;
  const links = [['Home', '/app.html'], ['Verified partners', '/partners'], ['Rules', '/rules'], ['Privacy', '/privacy'], ['Terms of Use', '/terms']];
  const footer = document.createElement('footer');
  footer.className = 'revlo-site-footer';
  footer.innerHTML = `<style>
    .revlo-site-footer{border-top:1px solid #e5e8e3;background:#fff;padding:28px 20px 36px;font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
    .revlo-site-footer div{max-width:760px;margin:0 auto;display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;justify-content:space-between}
    .revlo-site-footer nav{display:flex;flex-wrap:wrap;gap:8px 18px}
    .revlo-site-footer a{color:#687068;font-weight:700;text-decoration:none}
    .revlo-site-footer a:hover{color:#1B5E20}
    .revlo-site-footer p{margin:0;color:#687068}
  </style><div><nav aria-label="Legal"></nav><p></p></div>`;
  const nav = footer.querySelector('nav');
  links.forEach(([label, href]) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    nav.appendChild(link);
  });
  footer.querySelector('p').textContent = `© ${new Date().getFullYear()} Revlo.ng. All rights reserved.`;
  const root = document.getElementById('root');
  (root ? root.parentNode : document.body).insertBefore(footer, root ? root.nextSibling : null);
})();
