import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, Row, Col } from "shards-react";
import { useTranslation } from "react-i18next";
import { HashLink } from 'react-router-hash-link';
import styled, { keyframes } from 'styled-components';
import { zoomIn } from 'react-animations';
import i18next from "i18next";

import PageTitle from "../common/PageTitle";
import { Store } from "../../flux";

const ZoomIn = styled.div`animation: .5s ${keyframes `${zoomIn}`}`;

const SignOfTheDay = ({wordItem}) => {
    // get the longest word for sotd, either the english or malay word
    const longSotd = wordItem.word.length > wordItem.perkataan ? wordItem.word : wordItem.perkataan;
    // get the length of word; or the longest substring if it contains space
    const length = longSotd.split(" ").sort((a, b) => (b.length-a.length))[0].length;
    const fontSizeTemp = 30-(length);

    // to set the font size of card title dynamically
    // based on window.width, number of cards, length of the word, and whether the word contains spaces
    const getFontSize = () => {
            if((window.innerWidth > 1250)) {
                return (length >= 10) ? (fontSizeTemp+2+"px") : "18px";
            }            
            else if((window.innerWidth > 1200)) {
                return (length >= 10) ? (fontSizeTemp+"px") : "17px";
            }           
            else if((window.innerWidth <= 1200 && window.innerWidth >= 875)) {
                return (length >= 10) ? "17px" : "18px";
            }    
            else if(window.innerWidth >= 765) {
                return (length >= 10) ? (fontSizeTemp-2+"px") : "17px";
            }                 
            else if((window.innerWidth <= 765 && window.innerWidth >= 500)) {
                return "18px";
            }
            else if((window.innerWidth <= 460 && window.innerWidth > 320)) {
                return (length >= 10) ? (fontSizeTemp-2+"px") : "17px";
            }
            else { return (length >= 10) ? (fontSizeTemp-3+"px") : "17px"; }
        }

    const [fontSize, setFontSize] = useState(
        getFontSize()
    );

    // setFontSize when window resizes
    function handleResize() {
        setFontSize(getFontSize());
    }
    window.addEventListener("resize", handleResize);

    // setFontSize when sotd to be displayed changes (switched language)
    useEffect(() => {
        setFontSize(getFontSize());
        return (_) => {
        window.removeEventListener("resize", handleResize);
        };
    }, [longSotd]);

    const groupCat = wordItem.groupCategory.toString().includes(",") ? 
        wordItem.groupCategory.toString().substring(0, wordItem.groupCategory.indexOf(",")) : // get the first group&category pair if there are multiple group&category pairs
        wordItem.groupCategory.toString();
    const linkToPath = "groups/"+Store.formatGroupCategory(groupCat)+"/"+Store.formatString(wordItem.word);
    const imgSrc = Store.getSignImgSrc(wordItem.perkataan);

    const { t } = useTranslation(["", "word"]);

    return (
        <Col sm="12" md="6" lg="6" xl="4" id="sotd">
            <div className="sotd-card-wrapper">                
            <HashLink smooth to={`/home#sotd`}>
                <PageTitle title={t("sign_of_the_day")} />
                </HashLink>
                <Link to={linkToPath}>
                    <Card small className="card-post card-post--aside card-post--1">
                        <Col lg="6" md="6" sm="6">
                        <ZoomIn className="card-post__image-wrapper">
                            <img
                                src={imgSrc}
                                alt={wordItem.word}
                                className="card-post__image"
                            />                            
                        </ZoomIn>
                        </Col>
                        <Col lg="6" md="6" sm="6">
                            <CardBody className="card-title">
                                <div className="vocab-word-perkataan">
                                    <div className="vocab-word-perkataan-title">
                                        <span style={{fontSize:fontSize}}>{i18next.language === "en" ? wordItem.word : wordItem.perkataan}</span>
                                    </div>
                                    <div className="vocab-word-perkataan-subtitle">
                                        <span style={{fontSize:fontSize}}>{i18next.language === "en" ? wordItem.perkataan : wordItem.word}</span>
                                    </div>
                                </div>
                            </CardBody>
                        </Col>
                    </Card>                    
                </Link>
            </div>
        </Col>
    );
};

export default SignOfTheDay;
