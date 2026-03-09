import axios from "axios";
import { Store } from "../../flux";

// Cache mechanism
const videosCache = new Map();
let cacheTimestamp = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// In-flight request deduplication — prevents multiple components from
// triggering parallel fetches for the same playlist
let inFlightRequest = null;

// Fetch featured videos from YouTube API
export const fetchFeaturedVideosFromAPI = async () => {
  try {
    const response = await axios.get(Store.getFeaturedVideosPlaylistUrl());

    if (!response.data?.items) {
      console.error('Invalid API response structure:', response);
      return null;
    }

    return response.data.items.map((item) => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.high.url,
      publishedAt: item.snippet.publishedAt
    }));
  } catch (error) {
    console.error("Error fetching featured videos:", error);
    return null;
  }
};

// Get featured videos with caching + request deduplication
export const getFeaturedVideos = async () => {
  try {
    const now = Date.now();

    // Return valid cache immediately
    if (cacheTimestamp && now - cacheTimestamp < CACHE_DURATION && videosCache.size > 0) {
      console.log(`Using cached data for featured videos`);
      return Array.from(videosCache.values());
    }

    // Check Store before hitting the network
    const storeVideos = Store.getFeaturedVideosList();
    if (storeVideos?.length > 0) {
      console.log(`Using Store data for featured videos`);

      videosCache.clear();
      storeVideos.forEach((video) => videosCache.set(video.id, video));
      cacheTimestamp = now;

      return storeVideos;
    }

    // Deduplicate concurrent requests
    if (inFlightRequest) {
      console.log("Reusing in-flight request for featured videos");
      return inFlightRequest;
    }

    console.log(`Cache and Store miss for featured videos, fetching from API`);

    inFlightRequest = fetchFeaturedVideosFromAPI()
      .then((videos) => {
        if (videos?.length > 0) {
          videosCache.clear();
          videos.forEach((video) => videosCache.set(video.id, video));
          cacheTimestamp = Date.now();
        }
        return videos;
      })
      .catch((error) => {
        console.error("Error in getFeaturedVideos:", error);
        console.log("Falling back to Store data for featured videos");
        return Store.getFeaturedVideosList();
      })
      .finally(() => {
        inFlightRequest = null;
      });

    return inFlightRequest;
  } catch (error) {
    console.error("Error in getFeaturedVideos:", error);
    console.log("Falling back to Store data for featured videos");
    return Store.getFeaturedVideosList();
  }
};

// Clear videos cache
export const clearVideosCache = () => {
  videosCache.clear();
  cacheTimestamp = null;
  inFlightRequest = null;
  console.log("Videos cache cleared");
};

// Get video URL
export const getVideoUrl = (videoId) => Store.getFeaturedVideoUrl(videoId);