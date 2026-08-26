import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v7.5A2.75 2.75 0 0 1 17.25 16H10l-4.8 4v-4.55A2.75 2.75 0 0 1 4 13.25v-7.5Z"
                fill="none"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="2"
            />
            <path
                d="m8.25 9.5 2.2 2.15 5.3-5.15"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
            />
        </svg>
    );
}
