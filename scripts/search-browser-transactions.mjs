import assert from 'node:assert/strict';
import {selectors as s,labeled,testId,assertPrivateReport} from './search-browser-driver.mjs';
const migration=labeled('Project identifier migration');
const selection=labeled('Project identifier migration selection');
const review=labeled('Review identifier migration scan');
const confirmation=labeled('Confirm selected identifier migration');
const impact=labeled('Migration combined impact');
const recipes=labeled('Migration mapping recipes');
const whitespace=labeled('Project whitespace cleanup');
const whitespaceResults=labeled('Project whitespace review results');
const whitespaceReview=labeled('Review project whitespace scan');
const whitespaceConfirm=labeled('Confirm project whitespace changes');
const manifest=labeled('Listed source manifest');
const manifestResults=labeled('Source manifest results');
const history=labeled('Source manifest history');
const comparison=labeled('Source manifest comparison');
const entry='src/a-entry.srp',helper='src/b-helper.srp',copy='src/c-copy.srp',test='tests/d-check.srp';
const secret='private transaction fixture literal';
async function fresh(d){
  await d.button(s.fixture,'Use transaction fixture');
  await d.wait('transaction fixture loaded',()=>JSON.parse(document.querySelector('[data-testid="transaction-documents"]').textContent)[0]?.name==='src/a-entry.srp');
  await d.wait('read counter reset',()=>document.querySelector('[data-testid="read-count"]').textContent==='0');
}
async function documents(d){
  return JSON.parse(await d.text(testId('transaction-documents')));
}
async function disk(d){
  return JSON.parse(await d.text(testId('transaction-disk')));
}
async function configureMigration(d,from='oldName',to='newName'){
  await d.button(migration,'Review project identifier migration');
  await d.change(labeled('Migration original 1'),from);
  await d.change(labeled('Migration replacement 1'),to);
}
async function scanMigration(d){
  await d.button(migration,'Review migration source scan');
  await d.visible(review);
  await d.contains(review,'4 selected of 4 listed sources');
  await d.button(review,'Confirm migration scan');
  await d.visible(selection);
  await d.contains(testId('busy'),'false');
}
async function stageSelected(d){
  await d.button(selection,'Select visible migration sites');
  await d.button(selection,'Review selected migration changes');
  await d.visible(confirmation);
}
async function openWhitespace(d){
  await d.button(whitespace,'Review project whitespace cleanup');
  await d.change(labeled('Project whitespace indentation'),'spaces');
  await d.change(labeled('Project whitespace line endings'),'lf');
}
async function scanWhitespace(d){
  await d.button(whitespace,'Review whitespace source scan');
  await d.visible(whitespaceReview);
  await d.button(whitespaceReview,'Confirm whitespace scan');
  await d.visible(whitespaceResults);
  await d.contains(testId('busy'),'false');
}
async function scanManifest(d){
  await d.button(manifest,'Review source manifest scan');
  await d.visible(labeled('Review source manifest scan'));
  await d.button(labeled('Review source manifest scan'),'Confirm source manifest scan');
  await d.visible(manifestResults);
  await d.contains(testId('busy'),'false');
}
export async function transactionScenarios(d,step){
  await step('Migration review is read-free until confirmed and excludes comments and string tokens',async()=>{
    await fresh(d);
    const initial=await documents(d);
    await configureMigration(d);
    await d.noReads(async()=>{
      await d.button(migration,'Review migration source scan');
      await d.visible(review);
      await d.button(review,'Review migration source labels');
      await d.contains(review,helper);
      await d.button(review,'Cancel migration scan review');
      await d.absent(review);
    });
    await scanMigration(d);
    await d.metric(selection,'Scanned sources',4);
    await d.metric(selection,'Retained sites',7);
    await d.metric(selection,'Selected sites',0);
    await d.metric(selection,'Spelling warnings',0);
    assert.equal(await d.counter('read-count'),3);
    assert.deepEqual(await documents(d),initial);
    await d.buttonDisabled(selection,'Review selected migration changes');
  });
  await step('Migration selection, combined preview and exports retain exact reviewed boundaries',async()=>{
    await fresh(d);
    await configureMigration(d);
    await scanMigration(d);
    await d.noReads(async()=>{
      await d.change(labeled('Migration source filter'),entry);
      await d.button(selection,'Select visible migration sites');
      await d.metric(selection,'Selected sites',2);
      await d.change(labeled('Migration source filter'),helper);
      await d.button(selection,'Select visible migration sites');
      await d.metric(selection,'Selected sites',4);
      await d.button(selection,'Review selected migration changes');
      await d.contains(confirmation,'4 replacements in 2 sources');
      await d.button(impact,'Review combined migration preview');
      await d.metric(impact,'Changed sources',2);
      await d.metric(impact,'Selected substitutions',4);
      await d.change(labeled('Migration combined preview source'),helper);
      await d.contains(impact,'newName');
      await d.button(impact,'Review migration impact report');
      const impactReport=await d.value(labeled('Migration impact report'));
      assertPrivateReport(impactReport,[entry,helper,'oldName','newName',secret]);
      await d.check(impact,'Include relative impact labels');
      assert.match(await d.value(labeled('Migration impact report')),/src\/a-entry\.srp/);
      await d.button(selection,'Review migration report');
      const value=await d.value(labeled('Migration inventory report'));
      assertPrivateReport(value,[entry,helper,'oldName','newName',secret]);
      await d.check(selection,'Include identifier mappings');
      const mappings=await d.value(labeled('Migration inventory report'));
      assert.match(mappings,/oldName/);
      assert.match(mappings,/newName/);
      assertPrivateReport(mappings,[entry,helper,secret]);
      await d.button(confirmation,'Cancel selected migration review');
      await d.absent(confirmation);
      await d.metric(selection,'Selected sites',4);
    });
  });
  await step('Migration stages only selected sources, preserves disk baselines and provides exact undo',async()=>{
    await fresh(d);
    const originalDisk=await disk(d),originalDocs=await documents(d);
    await configureMigration(d);
    await scanMigration(d);
    await d.change(labeled('Migration source filter'),entry);
    await d.button(selection,'Select visible migration sites');
    await d.change(labeled('Migration source filter'),helper);
    await stageSelected(d);
    await d.button(confirmation,'Confirm migration into open buffers');
    await d.contains(migration,'Staged 4 identifier replacements in 2 unsaved source(s).');
    await d.contains(testId('busy'),'false');
    assert.equal(await d.counter('read-count'),6);
    const staged=await documents(d);
    assert.equal(staged.length,2);
    const first=staged.find(doc=>doc.name===entry),second=staged.find(doc=>doc.name===helper);
    assert.equal(first.content,originalDocs[0].content.replace('bind oldName','bind newName').replace('print(oldName)','print(newName)'));
    assert.equal(first.savedContent,originalDocs[0].savedContent);
    assert.equal(second.content,second.savedContent.replaceAll('oldName','newName'));
    assert.equal(second.dirty,true);
    assert.deepEqual(await disk(d),originalDisk);
    await d.button(migration,'Undo last staged migration');
    const undone=await documents(d);
    assert.deepEqual(undone.find(doc=>doc.name===entry),originalDocs[0]);
    assert.equal(undone.find(doc=>doc.name===helper).dirty,false);
    assert.deepEqual(await disk(d),originalDisk);
    await d.buttonDisabled(migration,'Undo last staged migration');
  });
  await step('Migration rejects an externally changed unselected disk source',async()=>{
    await fresh(d);
    const original=await documents(d);
    await configureMigration(d);
    await scanMigration(d);
    await d.change(labeled('Migration source filter'),entry);
    await stageSelected(d);
    await d.button(s.fixture,'Change transaction disk externally');
    await d.button(confirmation,'Confirm migration into open buffers');
    await d.contains(migration,'A disk snapshot changed or became unavailable');
    await d.contains(testId('busy'),'false');
    assert.deepEqual(await documents(d),original);
    await d.buttonDisabled(migration,'Undo last staged migration');
  });
  await step('Migration failure and cancellation do not publish a partial editable inventory',async()=>{
    await fresh(d);
    const original=await documents(d);
    await configureMigration(d);
    await d.button(s.fixture,'Fail transaction copy read');
    await d.button(migration,'Review migration source scan');
    await d.button(review,'Confirm migration scan');
    await d.contains(testId('busy'),'false');
    await d.absent(selection);
    assert.deepEqual(await documents(d),original);
    await fresh(d);
    await configureMigration(d);
    await d.check(s.fixture,'Pause first synthetic read');
    await d.button(migration,'Review migration source scan');
    await d.button(review,'Confirm migration scan');
    await d.contains(testId('busy'),'true');
    await d.button(migration,'Cancel migration operation');
    await d.button(s.fixture,'Release synthetic read');
    await d.contains(migration,'Migration scan cancelled');
    await d.absent(selection);
    assert.deepEqual(await documents(d),original);
  });
  await step('Migration recipes require review and portable backups are opt-in',async()=>{
    await fresh(d);
    await configureMigration(d);
    await d.noReads(async()=>{
      await d.button(recipes,'Manage mapping recipes');
      await d.change(labeled('Migration recipe name'),'Rename symbols');
      await d.button(recipes,'Save current mappings as recipe');
      await d.change(labeled('Migration replacement 1'),'differentName');
      await d.button(recipes,'Review loading migration recipe');
      await d.visible(labeled('Review migration recipe change'));
      await d.button(labeled('Review migration recipe change'),'Cancel migration recipe change');
      await d.valueIs(labeled('Migration replacement 1'),'differentName');
      await d.button(recipes,'Review loading migration recipe');
      await d.button(labeled('Review migration recipe change'),'Confirm migration recipe change');
      await d.valueIs(labeled('Migration replacement 1'),'newName');
      await d.absent(labeled('Migration recipe backup'));
      await d.check(recipes,'Reveal private migration backup containing identifier names');
      const raw=await d.value(labeled('Migration recipe backup'));
      assert.match(raw,/newName/);
      assertPrivateReport(raw,[entry,helper,secret]);
      await d.button(migration,'Hide project identifier migration');
      await d.absent(labeled('Migration recipe backup'));
      await d.button(migration,'Review project identifier migration');
      await d.button(recipes,'Manage mapping recipes');
      await d.absent(labeled('Migration recipe backup'));
      await d.contains(recipes,'1 / 12');
    });
  });
  await step('Whitespace cleanup previews metrics without exposing source text in reports',async()=>{
    await fresh(d);
    const original=await documents(d);
    await openWhitespace(d);
    await d.noReads(async()=>{
      await d.button(whitespace,'Review whitespace source scan');
      await d.visible(whitespaceReview);
      await d.button(whitespaceReview,'Cancel whitespace scan review');
      await d.absent(whitespaceReview);
    });
    await scanWhitespace(d);
    await d.metric(whitespaceResults,'Reviewed sources',4);
    await d.metric(whitespaceResults,'Changed sources',4);
    await d.metric(whitespaceResults,'Selected sources',0);
    assert.deepEqual(await documents(d),original);
    await d.button(whitespaceResults,'Review whitespace edits for '+entry);
    await d.visible(labeled('Selected whitespace file details'));
    await d.contains(labeled('Selected whitespace file details'),'Whitespace symbols');
    await d.button(whitespaceResults,'Close whitespace file details');
    await d.button(whitespaceResults,'Review project whitespace report');
    assertPrivateReport(await d.value(labeled('Project whitespace report')),[entry,helper,secret,'oldName']);
    await d.check(whitespaceResults,'Include relative whitespace source labels');
    const output=await d.value(labeled('Project whitespace report'));
    assert.match(output,/src\/a-entry\.srp/);
    assertPrivateReport(output,[secret,'oldName']);
  });
  await step('Whitespace cleanup stages chosen files and preserves original dirty buffer through undo',async()=>{
    await fresh(d);
    const original=await documents(d),originalDisk=await disk(d);
    await openWhitespace(d);
    await scanWhitespace(d);
    await d.change(labeled('Whitespace source filter'),'a-entry');
    await d.button(whitespaceResults,'Select changed sources on this page');
    await d.change(labeled('Whitespace source filter'),'b-helper');
    await d.button(whitespaceResults,'Select changed sources on this page');
    await d.metric(whitespaceResults,'Selected sources',2);
    await d.button(whitespaceResults,'Review staging selected whitespace changes');
    await d.visible(whitespaceConfirm);
    await d.button(whitespaceConfirm,'Confirm stage whitespace changes');
    await d.contains(whitespace,'whitespace edits in 2 unsaved sources.');
    await d.contains(testId('busy'),'false');
    const staged=await documents(d);
    assert.equal(staged.length,2);
    assert.equal(staged.find(doc=>doc.name===entry).content,'bind oldName = 2;\n    print(oldName);\n// oldName '+secret+'\n');
    assert.equal(staged.find(doc=>doc.name===entry).savedContent,original[0].savedContent);
    assert.equal(staged.find(doc=>doc.name===helper).content,'pub funcra oldName() -> integer { return 3; }\nprint(oldName());\n');
    assert.deepEqual(await disk(d),originalDisk);
    await d.button(whitespace,'Undo last staged whitespace changes');
    const undone=await documents(d);
    assert.deepEqual(undone.find(doc=>doc.name===entry),original[0]);
    assert.equal(undone.find(doc=>doc.name===helper).dirty,false);
    await d.buttonDisabled(whitespace,'Undo last staged whitespace changes');
  });
  await step('Whitespace apply cancellation leaves every original buffer unchanged',async()=>{
    await fresh(d);
    const original=await documents(d);
    await openWhitespace(d);
    await scanWhitespace(d);
    await d.button(whitespaceResults,'Select changed sources on this page');
    await d.button(whitespaceResults,'Review staging selected whitespace changes');
    await d.check(s.fixture,'Pause first synthetic read');
    await d.button(whitespaceConfirm,'Confirm stage whitespace changes');
    await d.contains(testId('busy'),'true');
    await d.button(whitespace,'Cancel whitespace operation');
    await d.button(s.fixture,'Release synthetic read');
    await d.contains(whitespace,'Whitespace operation cancelled or invalidated');
    assert.deepEqual(await documents(d),original);
    await d.buttonDisabled(whitespace,'Undo last staged whitespace changes');
  });
  await step('Manifest reports duplicate hashes and never includes source text or native paths',async()=>{
    await fresh(d);
    await d.button(manifest,'Review source snapshot manifest');
    await scanManifest(d);
    await d.metric(manifestResults,'Hashed sources',4);
    await d.metric(manifestResults,'Equal digest groups',1);
    await d.metric(manifestResults,'Dirty matching tabs',1);
    assert.equal(await d.counter('read-count'),3);
    await d.button(manifestResults,'Review equal digest groups');
    await d.contains(labeled('Equal digest groups'),helper);
    await d.contains(labeled('Equal digest groups'),copy);
    await d.check(manifestResults,'Only equal-digest group members');
    await d.contains(manifestResults,'2 matching observations');
    await d.button(manifestResults,'Review source manifest report');
    const raw=await d.value(labeled('Source manifest report'));
    assertPrivateReport(raw,[entry,helper,secret,'oldName']);
    assert.doesNotMatch(raw,/[a-f0-9]{64}/);
    await d.check(manifestResults,'Include manifest digests');
    const digests=await d.value(labeled('Source manifest report'));
    assert.match(digests,/[a-f0-9]{64}/);
    assertPrivateReport(digests,[entry,helper,secret,'oldName']);
  });
  await step('Manifest baselines compare same-origin observations and validate imported metadata',async()=>{
    await fresh(d);
    await d.button(manifest,'Review source snapshot manifest');
    await scanManifest(d);
    await d.button(history,'Review source manifest history');
    await d.button(history,'Capture current source manifest');
    await d.metric(comparison,'Same observed digest and byte count',4);
    await d.check(history,'Reveal portable baseline including relative labels and digests');
    const raw=await d.value(labeled('Portable source manifest baseline'));
    const parsed=JSON.parse(raw);
    assert.equal(parsed.baseline.files.length,4);
    assertPrivateReport(raw,[secret,'oldName']);
    await d.button(s.fixture,'Change transaction disk externally');
    await scanManifest(d);
    await d.metric(comparison,'Observed digest changed',1);
    await d.metric(comparison,'Same observed digest and byte count',3);
    await d.change(labeled('Import source manifest baseline'),raw);
    await d.button(history,'Review manifest import');
    await d.visible(labeled('Review source manifest import'));
    await d.button(labeled('Review source manifest import'),'Confirm metadata-only manifest import');
    await d.contains(history,'Imported metadata retained for comparison only.');
    await d.metric(comparison,'Observed digest changed',1);
    parsed.baseline.files[0].name='../outside.srp';
    await d.change(labeled('Import source manifest baseline'),JSON.stringify(parsed));
    await d.button(history,'Review manifest import');
    await d.absent(labeled('Review source manifest import'));
    await d.contains(history,'Manifest source evidence is inconsistent');
    await d.change(labeled('Manifest snapshot mode'),'saved');
    await scanManifest(d);
    await d.contains(history,'Compare the same working-buffer or saved-disk snapshot mode.');
    assert.equal(await d.counter('read-count'),10);
  });
}
