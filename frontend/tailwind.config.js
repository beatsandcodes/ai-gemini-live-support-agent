/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
                display: ['Outfit', 'Inter', 'sans-serif'],
            },
            colors: {
                brand: {
                    50: '#f3f0ff',
                    100: '#e9e3ff',
                    200: '#d4c9ff',
                    300: '#b49eff',
                    400: '#9066ff',
                    500: '#7c3aed',
                    600: '#6d28d9',
                    700: '#5b21b6',
                    800: '#4c1d95',
                    900: '#3b0f7a',
                },
                surface: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    800: '#1e1b3a',
                    850: '#161330',
                    900: '#0d0a21',
                    950: '#080619',
                },
            },
            animation: {
                'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'voice-wave': 'voice-wave 1.2s ease-in-out infinite',
                'float': 'float 6s ease-in-out infinite',
                'fade-in': 'fade-in 0.4s ease-out',
                'slide-up': 'slide-up 0.4s ease-out',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                'pulse-ring': {
                    '0%': { transform: 'scale(0.9)', opacity: '1' },
                    '50%': { transform: 'scale(1.1)', opacity: '0.5' },
                    '100%': { transform: 'scale(0.9)', opacity: '1' },
                },
                'voice-wave': {
                    '0%, 100%': { transform: 'scaleY(0.3)' },
                    '50%': { transform: 'scaleY(1)' },
                },
                'float': {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-up': {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'shimmer': {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
};
