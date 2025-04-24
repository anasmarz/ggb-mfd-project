import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "shards-react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Link } from "react-router-dom";

import AboutUsPreview from "../components/about-us/AboutUsPreview";
import CategoryList from "../components/category-vocabs/CategoryList";
import FeaturedVideoList from "../components/featured-videos/FeaturedVideoList";
import SignOfTheDay from "../components/category-vocabs/SignOfTheDay";

const Home = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [homeGroups, setHomeGroups] = useState([]);
  const [categories, setCategories] = useState({});
  const [featuredVideos, setFeaturedVideos] = useState([]);
  const [signOfTheDay, setSignOfTheDay] = useState(null);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        // ---------------------------------------------------------------------
        // Fetch home groups (filtering groups where Remark equals "Home")
        // ---------------------------------------------------------------------
        const fetchHomeGroups = async () => {
          try {
            const response = await axios.get(
              "https://mfd-cms-test.onrender.com/api/category-groups?filters[Remark][$eq]=Home&pagination[pageSize]=25"
            );
            if (response.data && response.data.data) {
              const transformedData = response.data.data
                .map(item => ({
                  group: item.GroupCategory?.split('/')[0]?.trim() || '',
                  kumpulan: item.KumpulanKategori?.split('/')[0]?.trim() || '',
                  remark: item.Remark || '',
                  groupCategory: item.GroupCategory || '',
                  kumpulanKategori: item.KumpulanKategori || ''
                }))
                .filter(group => group.group && group.kumpulan);

              // Remove duplicates based on the group name
              const uniqueGroups = [];
              const seenGroups = new Set();
              transformedData.forEach(group => {
                if (!seenGroups.has(group.group)) {
                  seenGroups.add(group.group);
                  uniqueGroups.push(group);
                }
              });

              // Move "New Signs" to the end if it exists
              const newSignsIndex = uniqueGroups.findIndex(item => item.group === "New Signs");
              if (newSignsIndex > -1) {
                uniqueGroups.push(uniqueGroups.splice(newSignsIndex, 1)[0]);
              }
              setHomeGroups(uniqueGroups);
              return uniqueGroups;
            }
            return [];
          } catch (err) {
            console.error("Error fetching home groups:", err);
            return [];
          }
        };

        // ---------------------------------------------------------------------
        // Fetch categories for each home group
        // ---------------------------------------------------------------------
        const fetchCategoriesForGroups = async (groups) => {
          if (!groups || groups.length === 0) return {};

          const categoriesMap = {};
          // Extract unique group names from fetched home groups
          const groupNames = [...new Set(groups.map(g => g.group))];

          for (const groupName of groupNames) {
            try {
              if (groupName === "New Signs") {
                // For New Signs, fetch items marked as "Yes" in the "New" field
                const response = await axios.get(
                  "https://mfd-cms-test.onrender.com/api/alphabet-entries?filters[New][$eq]=Yes&pagination[pageSize]=25"
                );
                if (response.data && response.data.data) {
                  const newSigns = response.data.data
                    .map(item => ({
                      category: item.GroupCategory?.split('/')[1]?.trim() || '',
                      kategori: item.KumpulanKategori?.split('/')[1]?.trim() || ''
                    }))
                    .filter(item => item.category && item.kategori);

                  // Remove duplicate categories
                  const uniqueCategories = [];
                  const seenCategories = new Set();
                  newSigns.forEach(cat => {
                    if (!seenCategories.has(cat.category)) {
                      seenCategories.add(cat.category);
                      uniqueCategories.push(cat);
                    }
                  });
                  categoriesMap["New Signs"] = uniqueCategories;
                }
              } else {
                // For other groups, fetch categories using filter with groupName
                const response = await axios.get(
                  `https://mfd-cms-test.onrender.com/api/alphabet-entries?filters[GroupCategory][$containsi]=${groupName}/&pagination[pageSize]=10`
                );
                if (response.data && response.data.data) {
                  const groupCategories = response.data.data.reduce((acc, item) => {
                    const groupParts = item.GroupCategory?.split('/');
                    const kumpulanParts = item.KumpulanKategori?.split('/');
                    if (
                      groupParts &&
                      groupParts[0] === groupName &&
                      groupParts.length > 1 &&
                      kumpulanParts &&
                      kumpulanParts.length > 1
                    ) {
                      const category = groupParts[1];
                      const kategori = kumpulanParts[1];
                      // Avoid duplicate categories
                      if (category && !acc.find(c => c.category === category)) {
                        acc.push({ category, kategori });
                      }
                    }
                    return acc;
                  }, []);
                  categoriesMap[groupName] = groupCategories;
                }
              }
            } catch (err) {
              console.error(`Error fetching categories for group ${groupName}:`, err);
              categoriesMap[groupName] = [];
            }
          }
          setCategories(categoriesMap);
          return categoriesMap;
        };

        // ---------------------------------------------------------------------
        // Set featured video(s) directly with a known YouTube link
        // ---------------------------------------------------------------------
        const setStaticFeaturedVideo = async () => {
          // We are directly referring to the YouTube link.
          const videos = [
            {
              id: 1,
              title: "Featured Video",
              videoId: "P8WxtXMGzaE", // Video ID for https://youtu.be/P8WxtXMGzaE
              description: "This is the featured video."
            }
          ];
          setFeaturedVideos(videos);
          return videos;
        };

        // ---------------------------------------------------------------------
        // Fetch sign of the day 
        // ---------------------------------------------------------------------
        const fetchSignOfTheDay = async () => {
          try {
            // Format today's date as yyyy-mm-dd
            const today = new Date();
            const formattedDate = today.toISOString().split("T")[0];

            const response = await axios.get(
              `https://mfd-cms-test.onrender.com/api/alphabet-entries?filters[SOTD][$eq]=${formattedDate}`
            );
            if (response.data && response.data.data && response.data.data.length > 0) {
              const sotdData = response.data.data[0];
              const sotd = {
                word: sotdData.Word || '',
                perkataan: sotdData.Perkataan || '',
                video: sotdData.Video || '',
                groupCategory: sotdData.GroupCategory || '',
                kumpulanKategori: sotdData.KumpulanKategori || ''
              };
              setSignOfTheDay(sotd);
              return sotd;
            } else {
              // Fallback to a random sign if no sign is found for today
              const randomResponse = await axios.get(
                "https://mfd-cms-test.onrender.com/api/alphabet-entries?pagination[page]=1&pagination[pageSize]=1"
              );
              if (randomResponse.data && randomResponse.data.data && randomResponse.data.data.length > 0) {
                const randomData = randomResponse.data.data[0];
                const randomSotd = {
                  word: randomData.Word || '',
                  perkataan: randomData.Perkataan || '',
                  video: randomData.Video || '',
                  groupCategory: randomData.GroupCategory || '',
                  kumpulanKategori: randomData.KumpulanKategori || ''
                };
                setSignOfTheDay(randomSotd);
                return randomSotd;
              }
            }
            return null;
          } catch (error) {
            console.error("Error fetching sign of the day:", error);
            return null;
          }
        };

        // ---------------------------------------------------------------------
        // Execute all fetch operations in sequence
        // ---------------------------------------------------------------------
        const groups = await fetchHomeGroups();
        await Promise.all([
          fetchCategoriesForGroups(groups),
          setStaticFeaturedVideo(),
          fetchSignOfTheDay()
        ]);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching home data:", error);
        setIsLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  return (
    <>
      <AboutUsPreview />
      <Container fluid>
        <div className="category-list-wrapper">
          <Row>
            {!isLoading &&
              homeGroups
                .filter(group => group?.group && group.group !== "New Signs")
                .map((group, index) => (
                  <CategoryList
                    key={index}
                    group={group.group}
                    category={categories[group.group] || []}
                    className="category-list"
                  />
                ))}
          </Row>
          <Row>
            {/* View all categories button */}
            <Col sm="12" md="12" lg="12" className="btn-view-all-categories">
              <Link to="/groups">{t("view_all_category_btn")} &rarr;</Link>
            </Col>

            {/* New Signs Category */}
            {!isLoading && homeGroups.find(g => g.group === "New Signs") && (
              <CategoryList
                group={"New Signs"}
                category={categories["New Signs"] || []}
              />
            )}

            {/* Featured Videos List */}
            {!isLoading && <FeaturedVideoList videoItems={featuredVideos} />}

            {/* Sign of The Day */}
            {!isLoading && signOfTheDay && <SignOfTheDay wordItem={signOfTheDay} />}
          </Row>
        </div>
      </Container>
    </>
  );
};

export default Home;
