
async function test() {
  const url = 'http://ts.vietjewelers.com:7900/';
  console.log(`Fetching ${url}...`);
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response snippet: ${text.slice(0, 100)}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}
test();
