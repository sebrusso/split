/**
 * View Test Data Script
 *
 * Queries the Supabase database to show all groups, members, and their linking status.
 * Run with: node scripts/view-test-data.js
 */

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://rzwuknfycyqitcbotsvx.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6d3VrbmZ5Y3lxaXRjYm90c3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Nzc0MTcsImV4cCI6MjA4MzE1MzQxN30.TKXVVOCaiV-wX--V4GEPNg2yupF-ERSZFMfekve2yt8";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function viewTestData() {
  console.log("\n=== SplitFree Database Overview ===\n");

  // 1. Fetch all groups
  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });

  if (groupsError) {
    console.error("Error fetching groups:", groupsError);
    return;
  }

  console.log(`Total Groups: ${groups.length}\n`);

  // 2. For each group, fetch members and expenses
  for (const group of groups) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`${group.emoji || "💰"} GROUP: ${group.name}`);
    console.log(`${"=".repeat(60)}`);
    console.log(`  ID: ${group.id}`);
    console.log(`  Share Code: ${group.share_code}`);
    console.log(`  Currency: ${group.currency || "USD"}`);
    console.log(`  Created: ${new Date(group.created_at).toLocaleDateString()}`);
    console.log(`  Archived: ${group.archived_at ? "Yes" : "No"}`);
    console.log(`  Pinned: ${group.pinned ? "Yes" : "No"}`);

    // Fetch members for this group
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("*")
      .eq("group_id", group.id);

    if (membersError) {
      console.error(`  Error fetching members: ${membersError.message}`);
      continue;
    }

    console.log(`\n  Members (${members.length}):`);
    for (const member of members) {
      const linkedStatus = member.clerk_user_id
        ? `✓ LINKED (${member.clerk_user_id.substring(0, 15)}...)`
        : "✗ NOT LINKED (guest)";
      console.log(`    - ${member.name} [${member.id.substring(0, 8)}...]`);
      console.log(`      Status: ${linkedStatus}`);
    }

    // Fetch expenses for this group
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select(`
        *,
        payer:members!paid_by(name)
      `)
      .eq("group_id", group.id)
      .order("created_at", { ascending: false });

    if (expensesError) {
      console.error(`  Error fetching expenses: ${expensesError.message}`);
      continue;
    }

    console.log(`\n  Expenses (${expenses.length}):`);
    if (expenses.length === 0) {
      console.log("    (no expenses)");
    } else {
      for (const expense of expenses.slice(0, 5)) { // Show first 5
        const payerName = expense.payer?.name || "Unknown";
        console.log(`    - $${expense.amount.toFixed(2)} "${expense.description}" (paid by ${payerName})`);
      }
      if (expenses.length > 5) {
        console.log(`    ... and ${expenses.length - 5} more`);
      }
    }
  }

  // 3. Show summary of unique Clerk user IDs found
  console.log(`\n\n${"=".repeat(60)}`);
  console.log("CLERK USER ID SUMMARY");
  console.log(`${"=".repeat(60)}`);

  const { data: allMembers } = await supabase
    .from("members")
    .select("clerk_user_id, name, group_id")
    .not("clerk_user_id", "is", null);

  const clerkIds = [...new Set(allMembers?.map(m => m.clerk_user_id) || [])];

  console.log(`\nLinked Clerk User IDs found: ${clerkIds.length}`);
  for (const clerkId of clerkIds) {
    const membersWithId = allMembers?.filter(m => m.clerk_user_id === clerkId) || [];
    console.log(`\n  ${clerkId}`);
    console.log(`  Linked to ${membersWithId.length} member(s) across groups`);
    for (const m of membersWithId) {
      console.log(`    - "${m.name}"`);
    }
  }

  // 4. Show unlinked members
  const { data: unlinkedMembers } = await supabase
    .from("members")
    .select("name, group_id, id")
    .is("clerk_user_id", null);

  console.log(`\n\nUnlinked Members (guests): ${unlinkedMembers?.length || 0}`);
  if (unlinkedMembers && unlinkedMembers.length > 0) {
    console.log("These members have no associated Clerk user ID:\n");
    for (const m of unlinkedMembers.slice(0, 20)) {
      console.log(`  - "${m.name}" (member ID: ${m.id.substring(0, 8)}...)`);
    }
    if (unlinkedMembers.length > 20) {
      console.log(`  ... and ${unlinkedMembers.length - 20} more`);
    }
  }

  console.log("\n");
}

viewTestData().catch(console.error);
