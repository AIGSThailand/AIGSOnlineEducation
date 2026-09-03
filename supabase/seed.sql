-- ==============================================================================
-- AIGS Online Education Platform - Seed Data (LOCAL / TESTING ONLY)
-- ==============================================================================
-- Synthetic sample data only. Do NOT use real student emails, production WordPress
-- users, live Stripe IDs, or production credentials.
-- Runs automatically after `supabase db reset` (see supabase/config.toml).
-- Create test auth users via Supabase Auth API — profiles are created by trigger.

-- 1. Sample Demo Courses
INSERT INTO public.courses (id, title, slug, description, status, thumbnail_url, wordpress_course_id)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'Introduction to AI & Prompt Engineering',
        'intro-to-ai-and-prompt-engineering',
        'Master the fundamentals of generative AI, large language models, and structured prompt design.',
        'published',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
        101
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'Full-Stack Modern Web Architecture',
        'full-stack-modern-web-architecture',
        'Learn to build scalable, production-grade applications using Next.js App Router, Supabase, and Stripe.',
        'published',
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
        102
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'Advanced Applied Machine Learning',
        'advanced-applied-machine-learning',
        'Deep dive into PyTorch, transformer fine-tuning, retrieval-augmented generation (RAG), and model evaluation.',
        'draft',
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
        103
    )
ON CONFLICT (id) DO NOTHING;

-- 2. Sample Modules for Course 1
INSERT INTO public.modules (id, course_id, title, sort_order)
VALUES
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111',
        'Module 1: Foundations of Modern AI',
        1
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '11111111-1111-1111-1111-111111111111',
        'Module 2: Advanced Prompt Engineering Techniques',
        2
    )
ON CONFLICT (id) DO NOTHING;

-- 2b. Mirror modules → course_sections (Phase 2 backfill runs before seed)
INSERT INTO public.course_sections (id, course_id, title, sort_order)
VALUES
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111',
        'Module 1: Foundations of Modern AI',
        1
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '11111111-1111-1111-1111-111111111111',
        'Module 2: Advanced Prompt Engineering Techniques',
        2
    )
ON CONFLICT (id) DO NOTHING;

-- 3. Sample Lessons for Course 1
INSERT INTO public.lessons (id, module_id, course_id, title, slug, content, video_url, sort_order, wordpress_lesson_id)
VALUES
    (
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111',
        'Lesson 1.1: What are Large Language Models?',
        'what-are-llms',
        'In this introductory lesson, we explore tokenization, neural attention mechanisms, and how modern language models generate probabilistic text.',
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        1,
        201
    ),
    (
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111',
        'Lesson 1.2: The Anatomy of an LLM Context Window',
        'anatomy-of-context-window',
        'Learn how input tokens, system instructions, and completion tokens interact within bounded context windows.',
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        2,
        202
    ),
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '11111111-1111-1111-1111-111111111111',
        'Lesson 2.1: Few-Shot and Chain-of-Thought Prompting',
        'few-shot-and-chain-of-thought',
        'Understand structured decomposition, few-shot exemplars, and self-consistency techniques for reliable reasoning.',
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        3,
        203
    )
ON CONFLICT (id) DO NOTHING;

-- 3b. Mirror lessons → course_steps (same UUIDs as modules for section_id)
INSERT INTO public.course_steps (
    course_id, step_type, lesson_id, section_id, sort_order, is_required, parent_step_id
)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'lesson',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        0,
        true,
        NULL
    ),
    (
        '11111111-1111-1111-1111-111111111111',
        'lesson',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        1,
        true,
        NULL
    ),
    (
        '11111111-1111-1111-1111-111111111111',
        'lesson',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        2,
        true,
        NULL
    )
ON CONFLICT DO NOTHING;
