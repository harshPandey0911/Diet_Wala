/**
 * Default texts of the website (desktop) view of the DietVala user app: the sections around the real
 * categories, meals and restaurants on /food/user. The admin can change every text and icon in
 * Admin > Website Content; whatever is not changed falls back to this. Pictures, categories, meals and
 * prices always come from the real data, never from here.
 * Keep this file identical to Frontend/src/app/website/websiteDefaults.js (used when the API is unreachable).
 */
export const WEBSITE_DEFAULTS = {
    hero: {
        tags: ['Healthy Meals', 'Fitness Diets', 'Weight Management'],
        titleLine1: 'Healthy Food.',
        titlePrefix: 'Made for',
        titleHighlight: 'Your Goals.',
        description: 'Fresh, nutritious and delicious meals for gym lovers, fitness enthusiasts and anyone who wants to eat better.',
        primaryCta: 'Order Now',
        secondaryCta: 'Under ₹250',
        highlights: [
            { icon: 'leaf', title: 'Freshly Prepared', text: 'Everyday' },
            { icon: 'check', title: 'Clean Ingredients', text: 'No Junk' },
            { icon: 'clock', title: 'On-Time Delivery', text: 'As Promised' },
            { icon: 'heart', title: 'Affordable &', text: 'Quality Meals' }
        ]
    },
    why: {
        visible: true,
        title: 'Why Choose',
        highlight: 'DietVala?',
        subtitle: 'Because your health matters.',
        items: [
            { icon: 'utensils', title: 'Healthy Meals', text: 'Balanced nutrition for everyday life.' },
            { icon: 'dumbbell', title: 'Fitness Friendly', text: 'Special options for gym-goers.' },
            { icon: 'shield', title: 'Transparent Menu', text: 'Clear ingredients, portion & pricing.' },
            { icon: 'headset', title: 'Customer Support', text: "We're here to help, always." }
        ]
    },
    menu: {
        visible: true,
        eyebrow: 'Our Menu',
        title: 'Fuel Your Fitness',
        highlight: 'With Real Food',
        subtitle: 'Simple. Clean. Healthy.',
        ctaLabel: 'View Full Menu'
    },
    popular: {
        visible: true,
        title: 'Popular Meals',
        ctaLabel: 'View All'
    },
    how: {
        visible: true,
        title: 'How It Works',
        subtitle: 'Ordering your healthy meal is just 4 simple steps.',
        steps: [
            { icon: 'smartphone', title: 'Choose Your Meal', text: 'Browse our menu and pick your favourite meal.' },
            { icon: 'map', title: 'Share Your Details', text: 'Tell us your delivery area and address.' },
            { icon: 'card', title: 'Confirm & Pay', text: 'Get price, availability and delivery details.' },
            { icon: 'truck', title: 'Receive & Enjoy', text: 'Your meal will be delivered fresh and on time.' }
        ]
    }
};

export default WEBSITE_DEFAULTS;
