const ticketTestEnv = require("../env.cjs");
// Credentials arrive on stdin; run normal, ga, then ga-extra.
// GA modes temporarily change the real GA group and always restore its snapshot.
// Reuse only with explicit authorization to test GA. Retain the report outside Vite.
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const work = process.env.HANDLING_REPORT || "/tmp/handling-live-state.json",
  root = ticketTestEnv.apiUrl;
const r = fs.existsSync(work)
  ? JSON.parse(fs.readFileSync(work, "utf8"))
  : {
      prefix:
        "TEST_HANDLING_" + Date.now().toString(36).slice(-6).toUpperCase(),
      checks: [],
      snapshots: [],
      tickets: [],
      writes: [],
      findings: [],
      startedAt: new Date().toISOString(),
    };
for (const check of r.checks) {
  if (check.name === "ga-assigned-handler-b-completes" && check.status === 5) {
    check.ticketStatus = 5;
    check.status = "passed";
  }
}
const save = () => fs.writeFileSync(work, JSON.stringify(r, null, 2) + "\n");
const check = (name, condition, detail = {}) => {
  const { status: ticketStatus, ...rest } = detail;
  const c = {
    name,
    status: condition ? "passed" : "failed",
    ...rest,
    ...(ticketStatus !== undefined ? { ticketStatus } : {}),
  };
  const i = r.checks.findIndex((c) => c.name === name);
  if (i < 0) r.checks.push(c);
  else r.checks[i] = c;
  save();
  console.log(JSON.stringify(c));
  return condition;
};
(async () => {
  const creds = JSON.parse(fs.readFileSync(0, "utf8")),
    tokens = {};
  const admin = "admin",
    a = "test_act22_a_iwa0tx",
    b = "test_act22_b_iwa0tx",
    creator = "test_p261021_all",
    approver = "test_form20_reader_ivdviv";
  const login = async (user, password) => {
    const response = await fetch(root + "/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password }),
    });
    assert(response.ok, "Login " + user + " " + response.status);
    tokens[user] = await response.json();
  };
  for (const [user, password] of Object.entries(creds).filter(
    ([k]) => !k.startsWith("_"),
  ))
    await login(user, password);
  const ids = [817, 818];
  r.groupName = "TEST_HND_" + r.prefix.split("_").at(-1);
  if (r.normalBase) r.normalBase.name = r.groupName;
  save();
  const own = (id) => r.tickets.some((t) => t.id === Number(id));
  const api = async (user, path, body, method = "POST") => {
    if (body !== undefined) {
      let allowed = false;
      if (path === "/usermmanager/")
        allowed =
          body instanceof FormData &&
          body.get("username").startsWith("test_handling_") &&
          body.get("chucvu") === "39";
      if (path === "/handlinggroupmmanager/")
        allowed =
          body.name === r.groupName &&
          ids.includes(body.is_manager) &&
          body.ls_member.every((id) => ids.includes(id));
      if (path === "/handlinggroupmmanager/" + r.groupId)
        allowed =
          body.name === r.groupName &&
          ids.includes(body.is_manager) &&
          body.ls_member.every((id) => ids.includes(id));
      if (path === "/handlinggroupmmanager/2")
        allowed =
          process.argv[2]?.startsWith("ga") &&
          r.gaOriginal &&
          body.name === r.gaOriginal.name &&
          body.group_email === r.gaOriginal.group_email &&
          body.description === r.gaOriginal.description &&
          body.is_active === r.gaOriginal.is_active &&
          [r.gaOriginal.is_manager, ...ids].includes(body.is_manager) &&
          r.gaOriginal.ls_member.every((id) => body.ls_member.includes(id)) &&
          body.ls_member.every((id) =>
            [...r.gaOriginal.ls_member, ...ids].includes(id),
          );
      if (path === "/tickettypemmanager/")
        allowed =
          body instanceof FormData &&
          body.get("name").startsWith(r.prefix) &&
          [String(r.groupId), "2"].includes(body.get("handling_group"));
      if (path === "/ticket_manager")
        allowed =
          body.title.startsWith(r.prefix) &&
          [r.typeId, r.gaTypeId].includes(body.ticket_type) &&
          [r.groupId, 2].includes(body.handling_group);
      if (
        [
          "/accept_ticket/",
          "/receive_ticket/",
          "/assignment_ticket/",
          "/change_assignment_ticket/",
          "/delete_assignment_ticket/",
          "/done_ticket/",
          "/cancel_ticket/",
          "/close_ticket/",
        ].includes(path)
      )
        allowed =
          own(body.ticket_id) &&
          (!body.ls_user_assignment ||
            body.ls_user_assignment.every((id) => ids.includes(id))) &&
          (!body.ls_user_delete ||
            body.ls_user_delete.every((id) => ids.includes(id))) &&
          (!body.user_assignment || ids.includes(body.user_assignment)) &&
          (!body.user_assignment_old || ids.includes(body.user_assignment_old));
      assert(allowed, "Write outside test scope " + path);
    }
    const response = await fetch(root + path, {
      signal: AbortSignal.timeout(15000),
      method: body === undefined ? "GET" : method,
      headers: {
        Authorization: "Bearer " + tokens[user].access,
        ...(body !== undefined && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(body === undefined
        ? {}
        : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      data = { nonJson: true };
    }
    if (body !== undefined) {
      r.writes.push({
        actor: user,
        path,
        method,
        httpStatus: response.status,
        body: body instanceof FormData ? Object.fromEntries(body) : body,
        response: { id: data.id, message: data.message, error: data.error },
      });
      if (
        path === "/ticket_manager" &&
        response.ok &&
        data.id &&
        !own(data.id)
      ) {
        r.tickets.push({
          id: data.id,
          title: body.title,
          groupId: body.handling_group,
          code: data.ticket_code,
        });
      }
      save();
    }
    assert(
      response.ok,
      path + " " + response.status + " " + JSON.stringify(data),
    );
    assert(!data.error, path + " " + data.error);
    return data;
  };
  if (!r.c) {
    const username =
        "test_handling_" + r.prefix.split("_").at(-1).toLowerCase(),
      body = new FormData();
    for (const [k, v] of Object.entries({
      username,
      msnv: "TH" + r.prefix.split("_").at(-1),
      first_name: "Handler C",
      last_name: "TEST",
      email: username + "@example.invalid",
      team: "90",
      bophan: "32",
      chucvu: "39",
      nhomquyen: "",
      is_active: "true",
    }))
      body.set(k, v);
    const data = await api(admin, "/usermmanager/", body);
    r.c = { id: data.id, username };
    save();
  }
  ids.push(r.c.id);
  const c = r.c.username;
  await login(c, creds._testPassword);
  const shape = (g) => ({
    name: g.name,
    description: g.description,
    is_active: g.is_active,
    is_manager: g.is_manager,
    group_email: g.group_email,
    ls_member: [...g.ls_member],
  });
  if (!r.groupId) {
    const body = {
      name: r.groupName,
      description: "TEST manager and membership regression; isolated fixture",
      is_active: true,
      is_manager: 817,
      group_email: r.prefix.toLowerCase() + "@example.invalid",
      ls_member: [817, 818],
    };
    const data = await api(admin, "/handlinggroupmmanager/", body);
    r.groupId = data.id;
    r.normalBase = body;
    save();
  }
  const createType = async (group, suffix) => {
    const body = new FormData();
    body.set("name", r.prefix + suffix);
    body.set("handling_group", String(group));
    body.set("is_active", "true");
    const t = await api(admin, "/tickettypemmanager/", body);
    return t.id;
  };
  if (!r.typeId) {
    r.typeId = await createType(r.groupId, "_NORMAL");
    save();
  }
  const create = async (group, type, name) => {
    let old = r.tickets.find((t) => t.title === r.prefix + " " + name);
    if (old) return old.id;
    const list = await api(
      creator,
      "/list_ticket/?typeView=create&columnSort=id&typeSort=descend&page_size=100&search=" +
        encodeURIComponent(r.prefix),
    );
    const found = list.results?.find((t) => t.title === r.prefix + " " + name);
    if (found) {
      r.tickets.push({
        id: found.id,
        title: found.title,
        groupId: group,
        code: found.ticket_code,
        reconciledAfterCreateError: true,
      });
      save();
      return found.id;
    }
    const data = await api(creator, "/ticket_manager", {
      handling_group: group,
      ticket_type: type,
      approve_user: 816,
      fore_cus: 2,
      bophansudung: 31,
      other1: "89",
      vanphong: 8,
      title: r.prefix + " " + name,
      description: "TEST manager/member assignments only",
      duedate: "2026-11-25",
      ticket_status: 1,
      formDataTicket: {
        dataform: { header: [], original_header: [], data: [{ key: 1 }] },
      },
    });
    assert(data.id);
    return data.id;
  };
  const snapshot = async (name, id) => {
    const actors = {};
    for (const user of [a, b, c]) {
      const t = await api(user, "/ticket_manager/" + id),
        profile = await api(user, "/list_permission/");
      actors[user] = {
        buttons: Object.keys(t.list_button || {}),
        candidates: Object.entries(t.list_user_not_received || {}).map(
          ([name, id]) => ({ name, id: Number(id) }),
        ),
        received: t.list_user_received,
        status: t.ticket_status,
        is_handling: profile.is_handling,
        can_assign: profile.can_assign,
        handlingPermission: profile.handlingPermission,
      };
    }
    r.snapshots.push({ name, ticketId: id, actors });
    save();
    return actors;
  };
  const config = async (manager, members) => {
    const body = { ...r.normalBase, is_manager: manager, ls_member: members };
    await api(admin, "/handlinggroupmmanager/" + r.groupId, body, "PUT");
    const read = shape(await api(admin, "/handlinggroupmmanager/" + r.groupId));
    check(
      "normal-config-" + manager + "-" + members.join("-"),
      read.is_manager === manager &&
        JSON.stringify([...read.ls_member].sort()) ===
          JSON.stringify([...members].sort()),
      { manager, members: read.ls_member },
    );
  };
  if (!process.argv[2]?.startsWith("ga")) {
    try {
      await config(817, [817, 818]);
      const id = await create(r.groupId, r.typeId, "NORMAL_APPROVED");
      r.normalTicket = id;
      save();
      let t = await api(admin, "/ticket_manager/" + id);
      if (t.ticket_status === 1)
        await api(approver, "/accept_ticket/", { ticket_id: id });
      let s = await snapshot("normal-initial-head-a", id);
      check("normal-head-a-can-assign", s[a].buttons.includes("Phân công"), {
        buttons: s[a].buttons,
      });
      check(
        "normal-member-b-not-manager",
        !s[b].buttons.includes("Phân công"),
        { buttons: s[b].buttons },
      );
      check(
        "normal-outsider-c-not-candidate",
        !s[a].candidates.some((u) => u.id === r.c.id),
      );
      await config(818, [817, 818]);
      s = await snapshot("normal-head-changed-a-to-b", id);
      check("normal-new-head-b-can-assign", s[b].buttons.includes("Phân công"));
      check(
        "normal-old-head-a-loses-assign",
        !s[a].buttons.includes("Phân công"),
      );
      await config(r.c.id, [817, 818]);
      s = await snapshot("normal-head-c-not-in-members", id);
      check(
        "normal-manager-independent-of-members",
        s[c].buttons.includes("Phân công"),
        { buttons: s[c].buttons, candidates: s[c].candidates },
      );
      for (const members of [[817, 818, r.c.id], [817, 818], [817], []]) {
        await config(r.c.id, members);
        s = await snapshot("normal-members-" + members.length, id);
        check(
          "normal-candidates-match-members-" + members.length,
          JSON.stringify(s[c].candidates.map((x) => x.id).sort()) ===
            JSON.stringify([...members].sort()),
          { expected: members, actual: s[c].candidates },
        );
      }
      await config(817, [817, 818]);
      s = await snapshot("normal-before-assign", id);
      t = await api(admin, "/ticket_manager/" + id);
      if (t.ticket_status === 2) {
        assert(s[a].buttons.includes("Phân công"));
        await api(a, "/assignment_ticket/", {
          ticket_id: id,
          ls_user_assignment: [818],
        });
      }
      t = await api(admin, "/ticket_manager/" + id);
      check(
        "normal-assign-member-b-processing",
        t.ticket_status === 3 &&
          t.list_user_received.some(
            (u) => Number(u.user_id) === 818 && u.status === "Đang xử lý",
          ),
      );
      await config(817, [817]);
      s = await snapshot("normal-assigned-member-b-removed-from-group", id);
      check(
        "normal-group-change-keeps-existing-assignment",
        s[a].received.some((u) => Number(u.user_id) === 818),
        { memberButtons: s[b].buttons, received: s[a].received },
      );
      check(
        "normal-removed-member-not-offered-again",
        !s[a].candidates.some((x) => x.id === 818),
      );
      await config(r.c.id, [817]);
      s = await snapshot("normal-manager-changed-during-processing", id);
      check(
        "normal-new-head-c-assign-on-processing-ticket",
        s[c].buttons.includes("Phân công"),
      );
      check(
        "normal-old-head-a-no-assign-during-processing",
        !s[a].buttons.includes("Phân công"),
      );
      if (
        s[c].buttons.includes("Phân công") &&
        s[c].candidates.some((x) => x.id === 817)
      ) {
        await api(c, "/assignment_ticket/", {
          ticket_id: id,
          ls_user_assignment: [817],
        });
        t = await api(admin, "/ticket_manager/" + id);
        check(
          "normal-new-manager-can-add-a",
          t.list_user_received.some(
            (u) => Number(u.user_id) === 817 && u.status === "Đang xử lý",
          ),
        );
      }
    } finally {
      await config(817, [817, 818]);
      r.normalRestored = true;
      save();
    }
    r.status = "normal-complete";
    save();
    return;
  }
  // GA is restored in finally even when any assertion/request fails. Existing real members are never removed.
  if (!r.gaOriginal) {
    r.gaOriginal = shape(await api(admin, "/handlinggroupmmanager/2"));
    r.gaOriginalVersion = (
      await api(admin, "/handlinggroupmmanager/2")
    ).updated;
    save();
  }
  assert.deepEqual(
    shape(await api(admin, "/handlinggroupmmanager/2")),
    r.gaOriginal,
    "GA changed since snapshot; stop without writes",
  );
  if (process.argv[2] === "ga-extra") {
    let changed = false;
    try {
      const set = async (manager, qa) => {
        const body = {
          ...r.gaOriginal,
          is_manager: manager,
          ls_member: [...new Set([...r.gaOriginal.ls_member, ...qa])],
        };
        changed = true;
        r.gaRestoreRequired = true;
        save();
        await api(admin, "/handlinggroupmmanager/2", body, "PUT");
      };
      await set(r.c.id, []);
      const id = await create(2, r.gaTypeId, "GA_MEMBERS_MATRIX");
      r.gaMatrixTicket = id;
      save();
      let t = await api(admin, "/ticket_manager/" + id);
      if (t.ticket_status === 1)
        await api(approver, "/accept_ticket/", { ticket_id: id });
      let s = await snapshot("ga-head-c-not-member", id);
      check(
        "ga-manager-independent-of-members",
        s[c].buttons.includes("Phân công"),
        { buttons: s[c].buttons },
      );
      for (const members of [[817, 818, r.c.id], [817, 818], [817], []]) {
        await set(r.c.id, members);
        s = await snapshot("ga-qa-members-" + members.length, id);
        const candidates = s[c].candidates
          .filter((x) => ids.includes(x.id))
          .map((x) => x.id)
          .sort();
        check(
          "ga-qa-candidates-match-members-" + members.length,
          JSON.stringify(candidates) === JSON.stringify([...members].sort()),
          {
            expected: members,
            actual: candidates,
            preservedRealMembers: r.gaOriginal.ls_member,
          },
        );
      }
      await set(r.c.id, [817, 818]);
      await api(c, "/assignment_ticket/", {
        ticket_id: id,
        ls_user_assignment: [817],
      });
      t = await api(admin, "/ticket_manager/" + id);
      check(
        "ga-manager-c-assigns-a",
        t.list_user_received.some(
          (u) => Number(u.user_id) === 817 && u.status === "Đang xử lý",
        ),
      );
      await api(c, "/change_assignment_ticket/", {
        ticket_id: id,
        user_assignment_old: 817,
        user_assignment: 818,
        lydothaydoinguoixuly: r.prefix + " GA replace TEST A by B",
      });
      t = await api(admin, "/ticket_manager/" + id);
      check(
        "ga-manager-c-changes-a-to-b",
        t.list_user_received.some(
          (u) => Number(u.user_id) === 818 && u.status === "Đang xử lý",
        ) &&
          !t.list_user_received.some(
            (u) => Number(u.user_id) === 817 && u.status === "Đang xử lý",
          ),
      );
      await set(817, [817]);
      s = await snapshot("ga-assigned-b-removed-member-head-a", id);
      check(
        "ga-removing-group-member-keeps-ticket-assignment",
        s[a].received.some((u) => Number(u.user_id) === 818),
        { removedMemberButtons: s[b].buttons },
      );
      if (s[b].buttons.includes("Hoàn thành")) {
        await api(b, "/done_ticket/", { ticket_id: id });
        t = await api(admin, "/ticket_manager/" + id);
        check(
          "ga-removed-member-completes-existing-assignment",
          t.ticket_status === 5,
          { ticketStatus: t.ticket_status },
        );
        await api(creator, "/close_ticket/", { ticket_id: id });
        check(
          "ga-matrix-ticket-closed",
          (await api(admin, "/ticket_manager/" + id)).ticket_status === 7,
        );
      }
    } finally {
      if (changed) {
        await api(admin, "/handlinggroupmmanager/2", r.gaOriginal, "PUT");
        assert.deepEqual(
          shape(await api(admin, "/handlinggroupmmanager/2")),
          r.gaOriginal,
        );
        r.gaRestoreRequired = false;
        r.gaRestoredAt = new Date().toISOString();
        check("ga-restored-after-extra-member-matrix", true);
        save();
      }
    }
    r.status = r.checks.some((c) => c.status === "failed")
      ? "completed-with-failures"
      : "passed";
    delete r.error;
    r.completedAt = new Date().toISOString();
    save();
    return;
  }
  let gaTouched = false;
  try {
    const gaSet = async (manager, qaMembers) => {
      const body = {
        ...r.gaOriginal,
        is_manager: manager,
        ls_member: [...new Set([...r.gaOriginal.ls_member, ...qaMembers])],
      };
      gaTouched = true;
      r.gaRestoreRequired = true;
      save();
      await api(admin, "/handlinggroupmmanager/2", body, "PUT");
      const actual = shape(await api(admin, "/handlinggroupmmanager/2"));
      check(
        "ga-config-" + manager + "-" + qaMembers.join("-"),
        actual.is_manager === manager &&
          JSON.stringify([...actual.ls_member].sort()) ===
            JSON.stringify([...body.ls_member].sort()),
        { manager, members: actual.ls_member },
      );
    };
    await gaSet(r.gaOriginal.is_manager, [817, 818]);
    if (!r.gaTypeId) {
      r.gaTypeId = await createType(2, "_GA");
      save();
    }
    const id = await create(2, r.gaTypeId, "GA_APPROVED");
    r.gaTicket = id;
    save();
    let t = await api(admin, "/ticket_manager/" + id);
    if (t.ticket_status === 1)
      await api(approver, "/accept_ticket/", { ticket_id: id });
    await snapshot("ga-original-head-with-test-members", id);
    await gaSet(817, [817, 818]);
    let s = await snapshot("ga-head-a", id);
    check("ga-head-a-has-assign", s[a].buttons.includes("Phân công"), {
      buttons: s[a].buttons,
    });
    if (
      s[a].buttons.includes("Phân công") &&
      s[a].candidates.some((x) => x.id === 818)
    ) {
      await api(a, "/assignment_ticket/", {
        ticket_id: id,
        ls_user_assignment: [818],
      });
      t = await api(admin, "/ticket_manager/" + id);
      check(
        "ga-head-a-assigns-test-member-b",
        t.ticket_status === 3 &&
          t.list_user_received.some((u) => Number(u.user_id) === 818),
      );
    }
    await gaSet(818, [817, 818]);
    s = await snapshot("ga-head-changed-a-to-b", id);
    check("ga-new-head-b-has-assign", s[b].buttons.includes("Phân công"), {
      buttons: s[b].buttons,
    });
    // Observe GA's special permissions instead of assuming they match ordinary departments.
    r.gaObserved = {
      oldHeadAfterChange: s[a].buttons,
      newHeadAfterChange: s[b].buttons,
      outsider: s[c].buttons,
    };
    save();
    await gaSet(818, [818]);
    s = await snapshot("ga-test-member-a-removed", id);
    check(
      "ga-removed-test-member-a-not-candidate",
      !s[b].candidates.some((x) => x.id === 817),
      { candidates: s[b].candidates, removedActorButtons: s[a].buttons },
    );
    if (s[b].buttons.includes("Hoàn thành")) {
      await api(b, "/done_ticket/", { ticket_id: id });
      t = await api(admin, "/ticket_manager/" + id);
      check("ga-assigned-handler-b-completes", t.ticket_status === 5, {
        status: t.ticket_status,
      });
    }
  } finally {
    if (gaTouched) {
      await api(admin, "/handlinggroupmmanager/2", r.gaOriginal, "PUT");
      const actual = shape(await api(admin, "/handlinggroupmmanager/2"));
      assert.deepEqual(actual, r.gaOriginal, "GA restore failed");
      r.gaRestoreRequired = false;
      r.gaRestoredAt = new Date().toISOString();
      r.gaRestored = actual;
      check("ga-original-head-members-and-other-config-restored", true);
      save();
    }
  }
  r.status = r.checks.some((c) => c.status === "failed")
    ? "completed-with-failures"
    : "passed";
  r.completedAt = new Date().toISOString();
  save();
  if (r.status !== "passed") process.exitCode = 1;
})().catch((e) => {
  r.error = e.message;
  r.status = "failed";
  save();
  console.error(e.stack);
  process.exitCode = 1;
});
