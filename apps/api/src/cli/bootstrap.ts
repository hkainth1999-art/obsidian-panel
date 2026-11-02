/**
 * Obsidian Panel — Initial Administrator Bootstrap CLI
 *
 * Requirements:
 * - Single-use bootstrap command for initial administrator setup
 * - Interactively prompts or takes arguments (--email, --username, --password)
 * - Hashes password using Argon2id
 * - Disables bootstrap once any administrator or user exists
 * - Never populates fake demo data
 */

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('\n=========================================');
  console.log('   Obsidian Panel — Administrator Setup   ');
  console.log('=========================================\n');

  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      console.error('❌ Error: An administrator or user account already exists.');
      console.error('   Bootstrap is disabled for existing installations.\n');
      process.exit(1);
    }

    const args = process.argv.slice(2);
    let email = '';
    let username = '';
    let password = '';

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--email' && args[i + 1]) email = args[++i]!;
      if (args[i] === '--username' && args[i + 1]) username = args[++i]!;
      if (args[i] === '--password' && args[i + 1]) password = args[++i]!;
    }

    if (!email) email = await prompt('Enter administrator email: ');
    if (!username) username = await prompt('Enter administrator username: ');
    if (!password) password = await prompt('Enter administrator password: ');

    if (!email || !username || !password) {
      console.error('❌ All fields are required.');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters long.');
      process.exit(1);
    }

    console.log('\nHashing credentials with Argon2id...');
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        password: passwordHash,
        isAdmin: true,
        emailVerifiedAt: new Date(),
      },
    });

    console.log('\n✅ Administrator account successfully created!');
    console.log(`   ID:       ${user.id}`);
    console.log(`   UUID:     ${user.uuid}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email:    ${user.email}`);
    console.log('   Role:     Administrator (Superuser)\n');
    console.log('You can now log in to the Obsidian web dashboard.\n');
  } catch (error: any) {
    console.error('❌ Bootstrap failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
