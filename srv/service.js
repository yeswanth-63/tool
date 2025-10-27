const cds = require('@sap/cds');
const { SELECT } = cds;

module.exports = cds.service.impl(function () {
  this.on('GetNextCustomerId', async (req) => {
    // fetch all sapcustId values (or a targeted query) and compute max suffix on the server
    const rows = await cds.run(SELECT.from('db.Customer').columns('sapcustId'));
    let max = 0;
    const pattern = /(\d+)$/;
    rows.forEach(r => {
      const id = r.sapcustId;
      if (id) {
        const m = String(id).match(pattern);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
    });
    const next = max + 1;
    return `cust-${String(next).padStart(4, '0')}`;
  });
});
