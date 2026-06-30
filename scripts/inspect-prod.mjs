const html = await (await fetch('https://chilimba.zedfleet.com/')).text();
const asset = html.match(/src="(\/assets\/[^"]+)"/)?.[1];
console.log('asset:', asset);
if (asset) {
  const js = await (await fetch(`https://chilimba.zedfleet.com${asset}`)).text();
  const apiMatch = js.match(/https:\/\/[^"']+railway[^"']*/g) ?? [];
  const apiV1 = js.includes('/api/v1');
  console.log('railway urls in bundle:', [...new Set(apiMatch)].slice(0, 5));
  console.log('bundle mentions /api/v1:', apiV1);
}