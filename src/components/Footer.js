"use client"
import React from 'react'
import Link from 'next/link'
import { useTitle } from '@/lib/store';
import { useStore } from 'zustand';
import Image from 'next/image';

function Footer() {
    const animetitle = useStore(useTitle, (state) => state.animetitle);
    const year = new Date().getFullYear();
    const month = new Date().getMonth();

    const handleToggle = () => {
        if (animetitle === 'english') {
            useTitle.setState({ animetitle: 'romaji' })
        } else {
            useTitle.setState({ animetitle: 'english' })
        }
    };

    function getSeason(month) {
        if (month === 12 || month === 1 || month === 2) {
            return 'WINTER';
        } else if (month === 3 || month === 4 || month === 5) {
            return 'SPRING';
        } else if (month === 6 || month === 7 || month === 8) {
            return 'SUMMER';
        } else {
            return 'FALL';
        }
    }

    const format = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

    function nextSeason(currentSeason) {
        const currentSeasonIndex = format.indexOf(currentSeason);
        const nextSeasonIndex = (currentSeasonIndex + 1) % format.length;
        return format[nextSeasonIndex];
    }

    return (
        <div>
            <footer className="bg-[#151518] mt-10">
                <div className="mx-auto w-full lg:max-w-[85%] p-4 py-6 lg:pt-8 lg:pb-3">
                    <div className="lg:flex lg:justify-between">
                        <div class="mb-6 lg:mb-0">
                            <Link class="flex items-center w-fit" href="/">
                                <p class="Kage self-center !text-4xl tracking-wider font-medium whitespace-nowrap dark:text-white">Kage</p>
                                </Link>
                            <p class="lg:text-[0.8rem] text-[0.7rem] text-[#ffffffb2] lg:w-[520px]">
                                This site does not store any files on our server, we are linked to the media which is hosted on 3rd party services.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 lg:gap-16 sm:gap-6 sm:grid-cols-2">
                            <div>
                                <ul className=" font-semibold flex flex-col gap-2 lg:text-[0.85rem] text-[0.7rem] text-[#ffffffb2] ">
                                    <li className="">
                                        <Link href={`/anime/catalog?season=${getSeason(month + 1)}&year=2024`} className="hover:text-white">This Season</Link>
                                    </li>
                                    <li className="">
                                        <Link href={`/anime/catalog?season=${nextSeason(getSeason(month + 1))}&year=2024`} className="hover:text-white">Upcoming Season</Link>
                                    </li>
                                    <li>
                                        <Link href="/anime/catalog?format=MOVIE" className="hover:text-white"> Movies</Link>
                                    </li>
                                    <li>
                                        <Link href="/anime/catalog?format=TV" className="hover:text-white"> Tv Shows</Link>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <ul className="font-semibold flex flex-col gap-2 lg:text-[0.85rem] text-[0.7rem] text-[#ffffffb2]">
                                    <li>
                                        <Link href="/dmca" className="hover:text-white"> DMCA</Link>
                                    </li>
                                    <li>
                                        <Link href="https://ko-fi.com/luckyhv" target='_blank' className="hover:text-white !font-semibold !text-[0.8rem]">Donate</Link>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='bg-tersier border-t border-white/5 mt-2'></div>
                <div className="mx-auto w-full lg:max-w-[83%] lg:flex lg:items-center lg:justify-between lg:text-[0.8rem] text-[0.7rem] text-[#ffffffb2] py-3">
                    <span className="sm:text-center ms-5 lg:ms-0">© {year} <Link href="/" className="hover:text-white">Kage™</Link> | Made by <span className="font-bold" >Dan</span>
                    </span>
                    <div className="flex mt-4 lg:justify-center lg:mt-0">
                        <div className="flex items-center ml-5">
                            <label className="relative cursor-pointer">
                                {animetitle && (
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={animetitle === 'english'}
                                        onChange={handleToggle}
                                    />
                                )}
                                <div className="w-[40px] text-xs h-4 flex items-center bg-[#EAEEFB] rounded-full  peer-checked:text-[#18181b] text-[black] font-bold after:flex after:items-center after:justify-center peer after:content-['JP'] peer-checked:after:content-['EN'] peer-checked:after:translate-x-3/4 after:absolute peer-checked:after:border-white after:bg-white after:border after:border-gray-300 after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#EAEEFB]">
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default Footer
