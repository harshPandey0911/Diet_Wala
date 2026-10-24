const photo = (id, w = 900) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;

/**
 * Default texts of the website (desktop) view of the DietVala user app: the sections around the real
 * categories, meals and restaurants on /food/user. The admin can change every text and icon in
 * Admin > Website Content; whatever is not changed falls back to this. Pictures, categories, meals and
 * prices always come from the real data, never from here.
 * Keep this file identical to Frontend/src/app/website/websiteDefaults.js (used when the API is unreachable).
 */
export const WEBSITE_DEFAULTS = {
    // The public promotional website at https://dietvala.com/ (no ordering there: it only promotes the app and
    // links to the stores). Everything here is editable in Admin > Website Content. Pictures and reviews are
    // sample content until the admin replaces them.
    site: {
        seo: {
            title: 'DietVala - Healthy Food Made for Your Goals',
            description: 'Fresh, nutritious and delicious meals for gym lovers, fitness enthusiasts and anyone who wants to eat better. Download the DietVala app.'
        },
        whatsappNumber: '',
        whatsappMessage: 'Hi DietVala, I would like to know more.',
        stores: {
            playStoreUrl: '',
            appStoreUrl: '',
            playStoreLabel: 'Google Play',
            appStoreLabel: 'App Store'
        },
        header: {
            logo: '',
            nav: [
                { label: 'Home', href: '#home' },
                { label: 'About Us', href: '#about' },
                { label: 'Our Menu', href: '#menu' },
                { label: 'How It Works', href: '#how' },
                { label: 'Contact', href: '#contact' }
            ],
            ctaLabel: 'Download App',
            ctaHref: '#download'
        },
        hero: {
            tags: ['Healthy Meals', 'Fitness Diets', 'Weight Management'],
            titleLine1: 'Healthy Food.',
            titlePrefix: 'Made for',
            titleHighlight: 'Your Goals.',
            description: 'Fresh, nutritious and delicious meals for gym lovers, fitness enthusiasts and anyone who wants to eat better.',
            storeHeading: 'Get the DietVala app',
            secondaryCta: 'Explore Menu',
            secondaryHref: '#menu',
            image: photo('photo-1546069901-ba9599a7e63c', 1400),
            script: 'Good Food\nGood Mood',
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
        about: {
            visible: true,
            eyebrow: 'About Us',
            title: 'Our Story',
            paragraphs: [
                'DietVala started with a simple idea - healthy food should be easy, convenient and affordable.',
                'We are a team of food lovers who understand the importance of good nutrition. Our mission is to provide fresh, homemade-style meals that help you stay fit, healthy and energized - every day.'
            ],
            ctaLabel: 'Know More',
            ctaHref: '#how',
            image: photo('photo-1556910103-1c02745aae4d', 1200),
            script: 'Healthy Food\nHappy You',
            points: [
                { icon: 'leaf', title: 'Fresh Ingredients', text: 'No artificial flavors' },
                { icon: 'chef', title: 'Hygienic Kitchen', text: 'Safe & clean preparation' },
                { icon: 'shield', title: 'Quality Check', text: 'Every meal is tested' },
                { icon: 'heart', title: 'Made with Care', text: 'For your health & happiness' }
            ]
        },
        menu: {
            visible: true,
            eyebrow: 'Our Menu',
            title: 'Fuel Your Fitness',
            highlight: 'With Real Food',
            subtitle: 'Simple. Clean. Healthy.',
            ctaLabel: 'View Full Menu',
            ctaHref: '#download',
            categories: [
                { name: 'Chicken Meals', subtitle: 'Lean • Protein Rich', prices: '₹150 / ₹200 / ₹250 / ₹300', image: photo('photo-1555939594-58d7cb561ad1', 600) },
                { name: 'Fish Meals', subtitle: 'Omega 3 • Healthy Fats', prices: '₹150 / ₹200 / ₹250 / ₹300', image: photo('photo-1467003909585-2f8a72700288', 600) },
                { name: 'Paneer & Soya Meals', subtitle: 'Vegetarian • High Protein', prices: '₹150 / ₹200 / ₹250 / ₹300', image: photo('photo-1604908176997-125f25cc6f3d', 600) },
                { name: 'Egg Meals', subtitle: 'Energy • Muscle Support', prices: '₹150 / ₹200 / ₹250 / ₹300', image: photo('photo-1490645935967-10de6ba17061', 600) },
                { name: 'Salads & Snacks', subtitle: 'Fresh • Light • Nutritious', prices: '₹150 / ₹200 / ₹250 / ₹300', image: photo('photo-1540189549336-e6e99c3679fe', 600) },
                { name: 'Sandwiches', subtitle: 'Quick • Healthy • Tasty', prices: '₹150 / ₹200 / ₹250 / ₹300', image: photo('photo-1473093295043-cdd812d0e601', 600) }
            ]
        },
        how: {
            visible: true,
            title: 'How It Works',
            subtitle: 'Ordering your healthy meal is just 4 simple steps.',
            image: photo('photo-1512621776951-a57141f2eefd', 1200),
            script: 'Healthy Food\nDelivered',
            steps: [
                { icon: 'smartphone', title: 'Choose Your Meal', text: 'Browse our menu and pick your favourite meal.' },
                { icon: 'map', title: 'Share Your Details', text: 'Tell us your delivery area and address.' },
                { icon: 'card', title: 'Confirm & Pay', text: 'Get price, availability and delivery details.' },
                { icon: 'truck', title: 'Receive & Enjoy', text: 'Your meal will be delivered fresh and on time.' }
            ]
        },
        testimonials: {
            visible: true,
            title: 'What Our Customers Say',
            items: [
                { name: 'Aman Khan', role: 'Gym Member', rating: 5, avatar: photo('photo-1507003211169-0a1dd7228f2d', 200), text: "Best healthy food I've had so far. Tastes great and keeps me full for long. Highly recommended!" },
                { name: 'Sneha Verma', role: 'Fitness Enthusiast', rating: 5, avatar: photo('photo-1494790108377-be9c29b29330', 200), text: 'Clean ingredients, good portion and on-time delivery. DietVala is now my daily partner.' },
                { name: 'Rohit Sharma', role: 'Regular Customer', rating: 5, avatar: photo('photo-1500648767791-00dcc994a43e', 200), text: 'Finally a healthy food option that actually tastes good. The chicken rice meal is my favorite.' }
            ]
        },
        contact: {
            visible: true,
            title: 'Contact Us',
            subtitle: 'We are here to help. Feel free to reach out for queries or support.',
            whatsappLabel: 'Chat on WhatsApp',
            phone: '',
            phoneNote: '(Click to chat)',
            email: '',
            emailNote: '(We usually reply within 24 hours)',
            hours: 'Mon - Sat: 8:00 AM - 10:00 PM\n(Sunday Off)',
            locationsTitle: 'Delivery Locations',
            locations: 'Mustafabad | Chand Bagh | Shiv Vihar |\nNehru Vihar | Brijpuri | Babu Nagar\n(And more...)',
            formTitle: 'Send Us a Message',
            formButton: 'Send Message',
            formSuccess: 'Thank you! We have received your message and will get back to you soon.'
        },
        footer: {
            social: { instagram: '', facebook: '', youtube: '' },
            copyright: '© 2026 DietVala. All rights reserved.'
        }
    },
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
