import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <div className="flex aspect-square size-10 items-center justify-center overflow-hidden rounded-full bg-white">
                <AppLogoIcon className="size-10 object-cover" />
            </div>
            <div className="ml-1 grid flex-1 text-left">
                <span className="truncate font-heading text-base leading-tight font-bold text-current">
                    STEP Messages
                </span>
                <span className="truncate text-[11px] text-current opacity-65">
                    Uhoo!
                </span>
            </div>
        </>
    );
}
