/**
 * Hashverb OS — permission helpers (pure, client-side).
 *
 * These are COSMETIC only: they decide which buttons and views to show. The
 * server re-checks every action, so a tampered client gains nothing. But the
 * match logic here MUST mirror the server's hvHasPerm_ exactly, or the UI will
 * offer actions the server then refuses (confusing) or hide actions the user
 * actually has (frustrating). This file is unit-tested against that contract.
 *
 * No DOM, no globals mutated — safe to run in a bare JS engine for tests.
 */
var HVPerm = (function () {

  /* Mirror of server hvHasPerm_: '*' matches all; 'ns.*' matches every
     'ns.<something>' deeply; otherwise exact. Empty key = deny. */
  function has(perms, key) {
    if (!key) return false;
    perms = perms || [];
    for (var i = 0; i < perms.length; i++) {
      var p = String(perms[i]);
      if (p === '*' || p === key) return true;
      if (p.length > 2 && p.charAt(p.length - 1) === '*' && p.charAt(p.length - 2) === '.' &&
          key.lastIndexOf(p.substring(0, p.length - 1), 0) === 0) return true;
    }
    return false;
  }

  /* True if the user holds ANY of the given keys. */
  function hasAny(perms, keys) {
    for (var i = 0; i < keys.length; i++) if (has(perms, keys[i])) return true;
    return false;
  }

  /**
   * The permission catalog the role editor presents. The server accepts any
   * dot-key, so this is just a friendly menu; it deliberately includes keys
   * for phases not built yet, so roles can be prepared ahead of the features.
   * '*' is offered on its own as "full control".
   */
  var CATALOG = [
    { group: 'Everything', keys: [
      { key: '*', label: 'Full control', desc: 'Every permission, present and future. Give sparingly.' }
    ]},
    { group: 'People & roles', keys: [
      { key: 'members.view',  label: 'View the member directory', desc: 'See who is in the org and their roles.' },
      { key: 'roles.manage',  label: 'Manage roles & members',    desc: 'Create roles, grant/revoke, suspend. Admin power.' }
    ]},
    { group: 'Teams', keys: [
      { key: 'teams.view',          label: 'View teams' },
      { key: 'teams.create',        label: 'Create teams' },
      { key: 'teams.manage',        label: 'Manage ANY team', desc: 'Org-wide team admin: edit, archive, and manage members of every team.' },
      { key: 'teams.manage.own',    label: 'Edit own team', desc: 'Usually granted by being a team lead/co-lead, not org-wide.' },
      { key: 'teams.members.manage', label: 'Add/remove team members', desc: 'Team leads and co-leads.' },
      { key: 'teams.lead.assign',   label: 'Appoint co-leads & transfer lead', desc: 'Team leads only.' },
      { key: 'teams.archive',       label: 'Archive a team' }
    ]},
    { group: 'Events', keys: [
      { key: 'events.view',           label: 'View events' },
      { key: 'events.create',         label: 'Create events' },
      { key: 'events.manage',         label: 'Manage ANY event', desc: 'Org-wide event admin: edit, stage, archive, and organizers of every event.' },
      { key: 'events.manage.own',     label: 'Edit own event & roadmap', desc: 'Usually from being an event manager/organizer, not org-wide.' },
      { key: 'events.stage.move',     label: 'Move an event between stages', desc: 'Event managers.' },
      { key: 'events.members.manage', label: 'Add/remove organizers' },
      { key: 'events.lead.assign',    label: 'Appoint organizers & transfer manager', desc: 'Event managers only.' },
      { key: 'events.archive',        label: 'Archive an event' }
    ]},
    { group: 'Work', keys: [
      { key: 'tasks.manage', label: 'Manage ANY task', desc: 'Org-wide: edit/assign/archive tasks in every team & event. Normally task authority comes from being a team/event member or manager.' }
    ]},
    { group: 'Communication', keys: [
      { key: 'flags.manage',        label: 'Manage ANY flag', desc: 'Org-wide: drive any flag through its lifecycle. Normally flag authority comes from being on the team/event involved.' },
      { key: 'comments.create',     label: 'Comment & @mention' },
      { key: 'announcements.post',  label: 'Post announcements', desc: 'Heads & secretaries.' }
    ]},
    { group: 'Recruitment', keys: [
      { key: 'applications.review', label: 'Review join applications', desc: 'See and process public "join #Hash" applications — includes applicant contact details.' }
    ]},
    { group: 'Files', keys: [
      { key: 'files.approve', label: 'Approve ANY file', desc: 'Org-wide file approver. Normally files are approved by the team/event manager. Uploading is open to members.' }
    ]},
    { group: 'Finance', keys: [
      { key: 'budgets.approve', label: 'Approve ANY budget', desc: 'Org-wide finance approver. Normally budgets are approved by the team/event manager; requesting is open to members.' }
    ]},
    { group: 'People ops', keys: [
      { key: 'meetings.manage', label: 'Manage org & any meeting', desc: 'Org-wide meeting manager. Team/event meetings are managed by their manager. Weekly check-ins are open to everyone.' }
    ]},
    { group: 'Insights', keys: [
      { key: 'reports.view', label: 'Leadership command center', desc: 'The org-wide dashboard: team health, flags, approvals, overdue work, activity.' }
    ]}
  ];

  /* Flat list of every catalog key, for validating the editor. */
  function catalogKeys() {
    var out = [];
    for (var i = 0; i < CATALOG.length; i++) {
      for (var j = 0; j < CATALOG[i].keys.length; j++) out.push(CATALOG[i].keys[j].key);
    }
    return out;
  }

  /**
   * The nav items a user should see, each gated by an "any of these perms"
   * rule. Home and Profile are always shown (no gate). Returns the ids in
   * order. Kept pure so the test can assert exactly what each role sees.
   */
  var NAV = [
    { id: 'home',    label: 'Home',    gate: null },
    { id: 'events',  label: 'Events',  gate: null },   /* directory is open to any signed-in member */
    { id: 'teams',   label: 'Teams',   gate: null },   /* directory is open to any signed-in member */
    { id: 'flags',   label: 'Flags',   gate: null },   /* everyone sees flags relevant to them */
    { id: 'command', label: 'Command', gate: ['reports.view'] },
    { id: 'members', label: 'Members', gate: ['members.view', 'roles.manage'] },
    { id: 'apply',   label: 'Applications', gate: ['applications.review'] },
    { id: 'roles',   label: 'Roles',   gate: ['roles.manage'] },
    { id: 'audit',   label: 'Activity', gate: ['roles.manage'] },
    { id: 'profile', label: 'Profile', gate: null }
  ];

  function navFor(perms) {
    var out = [];
    for (var i = 0; i < NAV.length; i++) {
      var item = NAV[i];
      if (!item.gate || hasAny(perms, item.gate)) out.push(item.id);
    }
    return out;
  }

  function canSeeView(perms, id) {
    return navFor(perms).indexOf(id) >= 0;
  }

  /* A short human summary of what a permission list grants, for role cards. */
  function summarize(perms) {
    if (has(perms, '*')) return 'Full control';
    if (!perms || !perms.length) return 'No permissions';
    if (perms.length <= 3) return perms.join(', ');
    return perms.length + ' permissions';
  }

  return {
    has: has, hasAny: hasAny, CATALOG: CATALOG, catalogKeys: catalogKeys,
    NAV: NAV, navFor: navFor, canSeeView: canSeeView, summarize: summarize
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HVPerm;
