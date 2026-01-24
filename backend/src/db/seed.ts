import bcrypt from 'bcryptjs';
import { pool, query } from './client';
import { logger } from '../utils/logger';
import { config } from '../config';

async function seed() {
  try {
    logger.info('Starting database seeding...');

    // Create default admin user
    const adminPassword = await bcrypt.hash('ChangeThisPassword123!', 12);

    const adminResult = await query(
      `INSERT INTO users (email, password_hash, display_name, role, auth_provider, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         role = EXCLUDED.role,
         updated_at = NOW()
       RETURNING id`,
      ['admin@surgemedia.us', adminPassword, 'Admin', 'admin', 'email', true]
    );

    const adminId = adminResult.rows[0].id;
    logger.info('Created admin user', { adminId });

    // Create homepage
    const homepageResult = await query(
      `INSERT INTO pages (slug, title, description, status, is_homepage, show_in_nav, nav_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         updated_at = NOW()
       RETURNING id`,
      ['home', 'Home', 'Welcome to Surge Media', 'published', true, true, 0, adminId]
    );

    const homepageId = homepageResult.rows[0].id;
    logger.info('Created homepage', { homepageId });

    // Create default hero block for homepage
    await query(
      `INSERT INTO blocks (page_id, type, title, content, settings, "order", is_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        homepageId,
        'hero',
        'Welcome to Surge Media',
        'Independent journalism for the people.',
        JSON.stringify({
          layout: 'full',
          backgroundColor: '#1a1a1a',
          textColor: '#ffffff',
        }),
        0,
        true,
      ]
    );

    // Create about page
    const aboutResult = await query(
      `INSERT INTO pages (slug, title, description, status, show_in_nav, nav_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         updated_at = NOW()
       RETURNING id`,
      ['about', 'About Us', 'Learn about Surge Media', 'published', true, 1, adminId]
    );

    const aboutId = aboutResult.rows[0].id;
    logger.info('Created about page', { aboutId });

    // Create about page content block
    await query(
      `INSERT INTO blocks (page_id, type, title, content, settings, "order", is_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        aboutId,
        'rich_text',
        'About Surge Media',
        '<p>Surge Media is an independent news organization dedicated to delivering honest, impactful journalism.</p><p>We cover stories that matter to our community and beyond.</p>',
        JSON.stringify({ layout: 'contained' }),
        0,
        true,
      ]
    );

    // Create contact page
    const contactResult = await query(
      `INSERT INTO pages (slug, title, description, status, show_in_nav, nav_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         updated_at = NOW()
       RETURNING id`,
      ['contact', 'Contact Us', 'Get in touch with Surge Media', 'published', true, 2, adminId]
    );

    const contactId = contactResult.rows[0].id;
    logger.info('Created contact page', { contactId });

    // Create donate page
    await query(
      `INSERT INTO pages (slug, title, description, status, show_in_nav, nav_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         updated_at = NOW()
       RETURNING id`,
      ['donate', 'Support Us', 'Support independent journalism', 'published', true, 3, adminId]
    );

    // Create default site settings
    const defaultSettings = [
      {
        key: 'site_name',
        value: JSON.stringify('Surge Media'),
      },
      {
        key: 'site_description',
        value: JSON.stringify('Independent journalism for the people'),
      },
      {
        key: 'contact_email',
        value: JSON.stringify('contact@surgemedia.us'),
      },
      {
        key: 'social_links',
        value: JSON.stringify({
          patreon: '',
          youtube: '',
          instagram: '',
          facebook: '',
          twitter: '',
          tiktok: '',
        }),
      },
      {
        key: 'theme',
        value: JSON.stringify({
          primaryColor: '#e63946',
          secondaryColor: '#1d3557',
          accentColor: '#f1faee',
        }),
      },
    ];

    for (const setting of defaultSettings) {
      await query(
        `INSERT INTO site_settings (key, value, updated_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           updated_at = NOW()`,
        [setting.key, setting.value, adminId]
      );
    }

    logger.info('Created default site settings');

    // Create a sample campaign
    await query(
      `INSERT INTO campaigns (title, slug, description, short_description, goal_amount_cents, status, is_published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         updated_at = NOW()`,
      [
        'General Support Fund',
        'general-support',
        'Help us continue our mission of independent journalism. Your contribution directly supports our reporters, equipment, and operations.',
        'Support independent journalism',
        1000000, // $10,000
        'active',
        true,
        adminId,
      ]
    );

    logger.info('Created sample campaign');

    // Create a sample form (poll)
    const formResult = await query(
      `INSERT INTO forms (title, slug, description, status, show_results, allow_multiple_submissions, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         updated_at = NOW()
       RETURNING id`,
      [
        'Audience Survey',
        'audience-survey',
        'Help us understand what content you want to see more of!',
        'published',
        true,
        false,
        adminId,
      ]
    );

    const formId = formResult.rows[0].id;

    // Add questions to the form
    await query(
      `INSERT INTO form_questions (form_id, type, question, options, is_required, "order")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        formId,
        'radio',
        'What type of content do you enjoy most?',
        ['Investigative Journalism', 'Breaking News', 'Opinion Pieces', 'Interviews', 'Documentary Features'],
        true,
        0,
      ]
    );

    await query(
      `INSERT INTO form_questions (form_id, type, question, options, is_required, "order")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        formId,
        'checkbox',
        'Which platforms do you follow us on?',
        ['YouTube', 'Patreon', 'Twitter/X', 'Instagram', 'Facebook', 'TikTok'],
        false,
        1,
      ]
    );

    await query(
      `INSERT INTO form_questions (form_id, type, question, is_required, "order")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [
        formId,
        'textarea',
        'What topics would you like us to cover?',
        false,
        2,
      ]
    );

    logger.info('Created sample form with questions');

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Database seeding failed', { error });
    throw error;
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
