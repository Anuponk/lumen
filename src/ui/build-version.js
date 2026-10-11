(() => {
 const meta=document.querySelector('meta[name="lumen-build"]');
 const label=document.getElementById("lumenAccountVersion");
 if(!label || !meta)return;
 const build=meta.content.trim();
 label.textContent="Version "+build;
 label.title="Version effectivement chargée : "+build;
})();
