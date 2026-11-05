import type { ImgHTMLAttributes } from 'react';

export default function AppLogoIcon(
    props: ImgHTMLAttributes<HTMLImageElement>,
) {
    return (
        <img alt="" src={`/assets/logo.png?v=${__LOGO_VERSION__}`} {...props} />
    );
}
