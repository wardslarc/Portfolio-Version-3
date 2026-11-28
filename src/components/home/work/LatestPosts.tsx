import Link from "next/link";
import { getLatestPosts } from "@/lib/blog/public";
import shellStyles from "../HomeShell.module.css";
import styles from "./MoreWork.module.css";

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function LatestPosts() {
  const posts = await getLatestPosts(3);
  if (posts.length === 0) return null;

  return (
    <div data-anim="reveal">
      <h3 className={styles.subHeading}>
        Latest from the{" "}
        <span className={`${shellStyles.serif} ${styles.headingAccent}`}>
          blog.
        </span>
      </h3>

      <ul className={styles.list}>
        {posts.map((post) => (
          <li key={post.id} className={styles.row}>
            <Link href={`/blog/${post.slug}`} className={styles.rowLink}>
              <span className={styles.rowTitle}>{post.title}</span>
              <span className={`${shellStyles.mono} ${styles.rowMeta}`}>
                {formatShortDate(post.publishedAt)} · {post.readingMinutes} min read
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/blog" className={`${shellStyles.btn} ${styles.secondaryBtn}`}>
        All posts →
      </Link>
    </div>
  );
}
